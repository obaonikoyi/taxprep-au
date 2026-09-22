using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TaxPrepAu.Api.Payslips;
using Xunit;

namespace TaxPrepAu.Api.Tests;

/*
 * What the assisted reader is allowed to spend.
 *
 * Time is injected rather than waited on: a limiter tested by sleeping is a
 * test suite that takes an hour, or one that fails when a runner is slow.
 */
public class PayslipReadLimiterTests
{
    private DateTimeOffset now = new(2026, 9, 23, 9, 0, 0, TimeSpan.Zero);
    private const string Alice = "203.0.113.10";
    private const string Bob = "203.0.113.11";

    private PayslipReadLimiter Limiter(int perClient = 3, int global = 100) => new(
    [
        new("this client", true, perClient, TimeSpan.FromHours(1)),
        new("everyone", false, global, TimeSpan.FromHours(1)),
    ], () => now);

    [Fact]
    public void AllowsUpToTheLimitAndThenRefuses()
    {
        var limiter = Limiter(perClient: 3);
        for (var i = 1; i <= 3; i++) Assert.True(limiter.TryRead(Alice).Allowed, $"read {i} should be allowed");
        Assert.False(limiter.TryRead(Alice).Allowed);
    }

    [Fact]
    public void SaysHowLongIsLeftOfTheWindow()
    {
        var limiter = Limiter(perClient: 1);
        limiter.TryRead(Alice);
        now = now.AddMinutes(20);
        var refused = limiter.TryRead(Alice);
        Assert.False(refused.Allowed);
        Assert.Equal(TimeSpan.FromMinutes(40), refused.RetryAfter);
    }

    [Fact]
    public void AllowsAgainOnceTheWindowHasPassed()
    {
        var limiter = Limiter(perClient: 1);
        Assert.True(limiter.TryRead(Alice).Allowed);
        Assert.False(limiter.TryRead(Alice).Allowed);
        now = now.AddHours(1).AddSeconds(1);
        Assert.True(limiter.TryRead(Alice).Allowed);
    }

    [Fact]
    public void CountsEachClientSeparately()
    {
        var limiter = Limiter(perClient: 1);
        Assert.True(limiter.TryRead(Alice).Allowed);
        Assert.False(limiter.TryRead(Alice).Allowed);
        Assert.True(limiter.TryRead(Bob).Allowed);
    }

    [Fact]
    public void CountsEveryClientIntoTheGlobalLimit()
    {
        // The layer that actually bounds the bill: two clients, well inside
        // their own allowances, still share one ceiling.
        var limiter = Limiter(perClient: 10, global: 3);
        Assert.True(limiter.TryRead(Alice).Allowed);
        Assert.True(limiter.TryRead(Bob).Allowed);
        Assert.True(limiter.TryRead(Alice).Allowed);
        Assert.False(limiter.TryRead(Bob).Allowed);
    }

    [Fact]
    public void DoesNotSpendTheGlobalBudgetOnARefusedRead()
    {
        // Alice is out of her own quota. If her refused attempts were charged to
        // everyone, she could empty the global budget without reading anything.
        var limiter = Limiter(perClient: 1, global: 3);
        Assert.True(limiter.TryRead(Alice).Allowed);
        for (var i = 0; i < 50; i++) Assert.False(limiter.TryRead(Alice).Allowed);
        // Exactly two of the three global reads are left, so her refusals were free.
        Assert.True(limiter.TryRead(Bob).Allowed);
        Assert.True(limiter.TryRead("203.0.113.12").Allowed);
        Assert.False(limiter.TryRead("203.0.113.13").Allowed);
    }

    [Fact]
    public void ReportsTheLongestWaitWhenSeveralLimitsAreReached()
    {
        // Being told to come back in a minute, only to be refused again by a
        // limit with a day left on it, is worse than being told the truth.
        var limiter = new PayslipReadLimiter(
        [
            new("this hour", false, 0, TimeSpan.FromHours(1)),
            new("today", false, 0, TimeSpan.FromDays(1)),
        ], () => now);
        Assert.Equal(TimeSpan.FromDays(1), limiter.TryRead(Alice).RetryAfter);
    }

    [Fact]
    public void RefusesEverythingWhenALimitIsZero()
    {
        // How a deployment switches the reader off without removing the key.
        var limiter = Limiter(perClient: 0);
        var refused = limiter.TryRead(Alice);
        Assert.False(refused.Allowed);
        Assert.True(refused.RetryAfter > TimeSpan.Zero);
    }

    [Fact]
    public void TracksNoMoreWindowsThanTheGlobalLimitAllows()
    {
        // A caller inventing a new address per request must not be able to grow
        // this dictionary: only an allowed read creates an entry, and allowed
        // reads are capped globally.
        var limiter = Limiter(perClient: 5, global: 4);
        for (var i = 0; i < 500; i++) limiter.TryRead($"198.51.100.{i % 250}");
        Assert.True(limiter.Tracked <= 4 + 1, $"tracked {limiter.Tracked} windows");
    }

    [Fact]
    public void MeasuresEachWindowFromItsOwnFirstRead()
    {
        var limiter = Limiter(perClient: 1);
        limiter.TryRead(Alice);
        now = now.AddMinutes(30);
        limiter.TryRead(Bob);
        now = now.AddMinutes(31);
        Assert.True(limiter.TryRead(Alice).Allowed, "Alice's hour is over");
        Assert.False(limiter.TryRead(Bob).Allowed, "Bob's hour is not");
    }
}

public class PayslipReadLimitMessageTests
{
    private static ReadLimitDecision Refused(TimeSpan wait, bool perClient) =>
        new(false, wait, new ReadLimit("x", perClient, 1, TimeSpan.FromHours(1)));

    [Fact]
    public void AlwaysOffersSomethingThatWorks()
    {
        foreach (var perClient in new[] { true, false })
            Assert.Contains("Enter the figures", PayslipReadLimiter.Message(Refused(TimeSpan.FromMinutes(5), perClient)));
    }

    [Theory]
    [InlineData(1, "1 minute")]
    [InlineData(40, "40 minutes")]
    public void CountsTheWaitInMinutesWhileThatIsUseful(int minutes, string expected)
        => Assert.Contains(expected, PayslipReadLimiter.Message(Refused(TimeSpan.FromMinutes(minutes), true)));

    [Fact]
    public void CountsALongWaitInHours()
        => Assert.Contains("11 hours", PayslipReadLimiter.Message(Refused(TimeSpan.FromHours(11), false)));

    [Fact]
    public void NeverSaysZeroMinutes()
        => Assert.Contains("1 minute", PayslipReadLimiter.Message(Refused(TimeSpan.FromSeconds(3), true)));

    [Fact]
    public void SaysWhetherItIsThisPersonOrEveryone()
    {
        Assert.StartsWith("You have had", PayslipReadLimiter.Message(Refused(TimeSpan.FromMinutes(5), true)));
        Assert.StartsWith("The assisted reader", PayslipReadLimiter.Message(Refused(TimeSpan.FromMinutes(5), false)));
    }
}

/*
 * Who is asking. Behind Cloudflare the connecting address is Cloudflare's, so
 * the header is all there is — and a header is written by the caller, so what
 * is kept from it matters.
 */
public class PayslipReadClientKeyTests
{
    private static HttpRequest Request(string? cloudflare = null, string? forwarded = null, string? remote = null)
    {
        var context = new DefaultHttpContext();
        if (cloudflare is not null) context.Request.Headers["CF-Connecting-IP"] = cloudflare;
        if (forwarded is not null) context.Request.Headers["X-Forwarded-For"] = forwarded;
        if (remote is not null) context.Connection.RemoteIpAddress = IPAddress.Parse(remote);
        return context.Request;
    }

    [Fact]
    public void PrefersTheAddressCloudflareReports()
        => Assert.Equal("203.0.113.5", PayslipReadLimiter.ClientKey(
            Request(cloudflare: "203.0.113.5", forwarded: "198.51.100.9", remote: "10.0.0.1")));

    [Fact]
    public void FallsBackToTheForwardedChainsFirstEntry()
        => Assert.Equal("198.51.100.9", PayslipReadLimiter.ClientKey(
            Request(forwarded: "198.51.100.9, 10.0.0.7, 10.0.0.8", remote: "10.0.0.1")));

    [Fact]
    public void FallsBackToTheConnectionWhenNoHeaderIsPresent()
        => Assert.Equal("10.0.0.1", PayslipReadLimiter.ClientKey(Request(remote: "10.0.0.1")));

    [Theory]
    [InlineData("not-an-address")]
    [InlineData("")]
    [InlineData("  ")]
    [InlineData("<script>alert(1)</script>")]
    public void IgnoresAHeaderThatIsNotAnAddress(string header)
        => Assert.Equal("10.0.0.1", PayslipReadLimiter.ClientKey(Request(cloudflare: header, remote: "10.0.0.1")));

    [Fact]
    public void IgnoresAnAbsurdlyLongHeader()
        => Assert.Equal("10.0.0.1", PayslipReadLimiter.ClientKey(
            Request(cloudflare: new string('1', 5000), remote: "10.0.0.1")));

    [Fact]
    public void CountsOneIPv6HouseholdAsOneClient()
    {
        // A phone is handed a whole /64 and can use a new address per request.
        var first = PayslipReadLimiter.ClientKey(Request(cloudflare: "2001:db8:abcd:1234::1"));
        var second = PayslipReadLimiter.ClientKey(Request(cloudflare: "2001:db8:abcd:1234:beef:cafe:1:2"));
        Assert.Equal(first, second);
        Assert.EndsWith("/64", first);
    }

    [Fact]
    public void KeepsSeparateIPv6NetworksApart()
        => Assert.NotEqual(
            PayslipReadLimiter.ClientKey(Request(cloudflare: "2001:db8:abcd:1234::1")),
            PayslipReadLimiter.ClientKey(Request(cloudflare: "2001:db8:abcd:9999::1")));

    [Fact]
    public void ReadsAnIPv4AddressWrittenAsIPv6AsItself()
        => Assert.Equal("203.0.113.5", PayslipReadLimiter.ClientKey(Request(cloudflare: "::ffff:203.0.113.5")));

    [Fact]
    public void AnswersSomethingEvenWithNoAddressAtAll()
        => Assert.Equal("unknown", PayslipReadLimiter.ClientKey(Request()));
}

/*
 * The limits are configuration, and configuration that is not read is a limit
 * that does not exist.
 */
public class PayslipReadLimitConfigurationTests
{
    private static PayslipReadLimiter FromSettings(params (string Key, string Value)[] settings)
        => PayslipReadLimiter.FromConfiguration(new ConfigurationBuilder()
            .AddInMemoryCollection(settings.Select(s => new KeyValuePair<string, string?>(s.Key, s.Value)))
            .Build());

    [Fact]
    public void HasFourLimits()
    {
        var limits = FromSettings().Limits;
        Assert.Equal(4, limits.Count);
        Assert.Equal(2, limits.Count(l => l.PerClient));
        Assert.Equal(2, limits.Count(l => l.Window == TimeSpan.FromDays(1)));
    }

    [Fact]
    public void DefaultsLeaveRoomForAFullYearOfPayslipsInOneSitting()
    {
        // 26 fortnightly or 52 weekly payslips, in batches of at most 20.
        var limits = FromSettings().Limits;
        var perClientHour = limits.Single(l => l.PerClient && l.Window == TimeSpan.FromHours(1));
        var perClientDay = limits.Single(l => l.PerClient && l.Window == TimeSpan.FromDays(1));
        Assert.True(perClientHour.Limit >= 20, "a whole batch must never meet a limit mid-batch");
        Assert.True(perClientDay.Limit >= 52, "a financial year of weekly payslips must fit in a day");
    }

    [Fact]
    public void KeepsTheGlobalLimitAboveWhatOnePersonMayUse()
    {
        var limits = FromSettings().Limits;
        foreach (var window in new[] { TimeSpan.FromHours(1), TimeSpan.FromDays(1) })
            Assert.True(
                limits.Single(l => !l.PerClient && l.Window == window).Limit >=
                limits.Single(l => l.PerClient && l.Window == window).Limit,
                $"the {window} global limit must not be below one person's");
    }

    [Fact]
    public void ReadsEachConfiguredNumber()
    {
        var limits = FromSettings(
            ("Payslips:ReadLimits:PerClientPerHour", "7"),
            ("Payslips:ReadLimits:PerClientPerDay", "8"),
            ("Payslips:ReadLimits:GlobalPerHour", "9"),
            ("Payslips:ReadLimits:GlobalPerDay", "11")).Limits;
        Assert.Equal(new[] { 7, 8, 9, 11 }, limits.Select(l => l.Limit).ToArray());
    }

    [Fact]
    public void KeepsZeroAsAWayToSwitchTheReaderOff()
        => Assert.Equal(0, FromSettings(("Payslips:ReadLimits:GlobalPerDay", "0"))
            .Limits.Single(l => !l.PerClient && l.Window == TimeSpan.FromDays(1)).Limit);

    [Theory]
    [InlineData("-1")]
    [InlineData("not a number")]
    [InlineData("")]
    public void FallsBackToTheDefaultRatherThanAcceptNonsense(string configured)
    {
        // A mistyped limit must not become an unlimited one.
        var limit = FromSettings(("Payslips:ReadLimits:GlobalPerDay", configured))
            .Limits.Single(l => !l.PerClient && l.Window == TimeSpan.FromDays(1)).Limit;
        Assert.Equal(FromSettings().Limits.Single(l => !l.PerClient && l.Window == TimeSpan.FromDays(1)).Limit, limit);
        Assert.True(limit > 0);
    }
}

/*
 * The endpoint, with a key configured and a limit of zero — which refuses every
 * read before any model is asked anything, so this needs no key that works and
 * no network.
 */
public class PayslipReadLimitEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> factory;
    private const string Endpoint = "/api/payslip/read";
    public PayslipReadLimitEndpointTests(WebApplicationFactory<Program> factory) => this.factory = factory;

    private HttpClient Client(params (string Key, string Value)[] settings) => factory
        .WithWebHostBuilder(builder => builder.ConfigureAppConfiguration((_, configuration) =>
            configuration.AddInMemoryCollection(settings.Select(s => new KeyValuePair<string, string?>(s.Key, s.Value)))))
        .CreateClient();

    private HttpClient RefusingClient() => Client(
        ("Anthropic:ApiKey", "not-a-real-key-and-never-used"),
        ("Payslips:ReadLimits:GlobalPerHour", "0"));

    [Fact]
    public async Task RefusesWithTooManyRequestsWhenTheLimitIsSpent()
    {
        var response = await RefusingClient().PostAsJsonAsync(Endpoint, new { text = new string('x', 100) });
        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
    }

    [Fact]
    public async Task SaysWhenToComeBack()
    {
        var response = await RefusingClient().PostAsJsonAsync(Endpoint, new { text = new string('x', 100) });
        Assert.True(response.Headers.TryGetValues("Retry-After", out var values), "no Retry-After header");
        Assert.True(int.TryParse(values!.Single(), out var seconds) && seconds > 0, "Retry-After must be a positive number of seconds");
    }

    [Fact]
    public async Task OffersManualEntryRatherThanJustRefusing()
    {
        var response = await RefusingClient().PostAsJsonAsync(Endpoint, new { text = new string('x', 100) });
        // Asserted before the body, because every other refusal this endpoint
        // can give also offers manual entry — passing on one of those would
        // prove nothing about the limit.
        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, object>>();
        Assert.NotNull(body);
        Assert.Contains("Enter the figures", body!["message"].ToString() ?? string.Empty);
    }

    [Fact]
    public async Task IsNotReachedWhenThereIsNoKeyToSpend()
    {
        // No key means no cost, so an unconfigured deployment keeps answering
        // 503 rather than counting requests it was never going to act on.
        var response = await Client(("Payslips:ReadLimits:GlobalPerHour", "0"))
            .PostAsJsonAsync(Endpoint, new { text = new string('x', 100) });
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
    }

    [Fact]
    public async Task DoesNotCountARequestThatWasNeverGoingToReachTheModel()
    {
        // The limit is zero, so anything that reached the limiter would be
        // refused. A 400 here means malformed requests are turned away before
        // they can use up an allowance — otherwise a caller could lock the
        // reader out for the day with requests that cost nothing to refuse.
        var response = await RefusingClient().PostAsJsonAsync(Endpoint, new { text = "too short" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public void CountsAcrossRequestsRatherThanForgettingBetweenThem()
        => Assert.Same(
            factory.Services.GetRequiredService<PayslipReadLimiter>(),
            factory.Services.GetRequiredService<PayslipReadLimiter>());
}
