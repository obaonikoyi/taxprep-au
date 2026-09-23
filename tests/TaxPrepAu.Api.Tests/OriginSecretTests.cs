using System.Net;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using TaxPrepAu.Api.Payslips;
using Xunit;

namespace TaxPrepAu.Api.Tests;

/*
 * Telling a request that came through our own front door from one that did not,
 * and what the answer is allowed to change.
 */
public class OriginSecretTests
{
    private const string Secret = "a-shared-secret-only-cloudflare-knows";

    private static OriginSecret From(params (string Key, string Value)[] settings)
        => OriginSecret.FromConfiguration(new ConfigurationBuilder()
            .AddInMemoryCollection(settings.Select(s => new KeyValuePair<string, string?>(s.Key, s.Value))).Build());

    private static HttpRequest Request(params (string Name, string Value)[] headers)
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse("10.0.0.7");
        foreach (var (name, value) in headers) context.Request.Headers[name] = value;
        return context.Request;
    }

    [Fact]
    public void BelievesEveryRequestUntilASecretIsConfigured()
    {
        // A deployment that has not set one up is exactly as it was, which is
        // why this can ship without breaking anybody.
        var secret = From();
        Assert.False(secret.Configured);
        Assert.True(secret.Trusts(Request()));
        Assert.True(secret.Trusts(Request(("CF-Connecting-IP", "203.0.113.5"))));
    }

    [Fact]
    public void BelievesARequestCarryingTheSecret()
    {
        var secret = From(("Payslips:OriginSecret:Value", Secret));
        Assert.True(secret.Configured);
        Assert.True(secret.Trusts(Request((OriginSecret.DefaultHeader, Secret))));
    }

    [Theory]
    [InlineData("")]
    [InlineData("wrong")]
    [InlineData("a-shared-secret-only-cloudflare-know")]
    [InlineData("a-shared-secret-only-cloudflare-knows ")]
    public void DoesNotBelieveARequestWithoutIt(string offered)
    {
        var secret = From(("Payslips:OriginSecret:Value", Secret));
        Assert.False(secret.Trusts(Request((OriginSecret.DefaultHeader, offered))));
    }

    [Fact]
    public void DoesNotBelieveARequestThatSimplyOmitsTheHeader()
        => Assert.False(From(("Payslips:OriginSecret:Value", Secret)).Trusts(Request(("CF-Connecting-IP", "203.0.113.5"))));

    [Fact]
    public void IgnoresAnAbsurdlyLongHeaderRatherThanHashingIt()
        => Assert.False(From(("Payslips:OriginSecret:Value", Secret)).Trusts(Request((OriginSecret.DefaultHeader, new string('x', 5000)))));

    [Fact]
    public void CanBeToldWhichHeaderToLookIn()
    {
        var secret = From(("Payslips:OriginSecret:Value", Secret), ("Payslips:OriginSecret:Header", "X-From-The-Front-Door"));
        Assert.True(secret.Trusts(Request(("X-From-The-Front-Door", Secret))));
        Assert.False(secret.Trusts(Request((OriginSecret.DefaultHeader, Secret))));
    }
}

public class ClientKeyTrustTests
{
    private static HttpRequest Request()
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse("10.0.0.7");
        context.Request.Headers["CF-Connecting-IP"] = "203.0.113.5";
        context.Request.Headers["X-Forwarded-For"] = "198.51.100.9";
        return context.Request;
    }

    [Fact]
    public void UsesTheForwardedAddressWhenTheRequestIsBelieved()
        => Assert.Equal("203.0.113.5", PayslipReadLimiter.ClientKey(Request(), trustForwarded: true));

    [Fact]
    public void FallsBackToTheConnectionWhenItIsNot()
    {
        // The point of the whole exercise: a caller who is not coming through
        // our front door cannot invent a new identity per request.
        Assert.Equal("10.0.0.7", PayslipReadLimiter.ClientKey(Request(), trustForwarded: false));
    }
}

/*
 * Saying something before the bill does.
 */
public class BudgetWarningTests
{
    private readonly DateTimeOffset now = new(2026, 9, 23, 9, 0, 0, TimeSpan.Zero);
    private readonly List<string> said = [];

    private PayslipReadLimiter Limiter(int global = 10, int warnAt = 80) => new(
    [
        new("this client", true, 1000, TimeSpan.FromHours(1)),
        new("all reads this hour", false, global, TimeSpan.FromHours(1)),
    ], () => now, said.Add, warnAt);

    [Fact]
    public void SaysNothingWhileThereIsPlentyLeft()
    {
        var limiter = Limiter(global: 10);
        for (var i = 0; i < 7; i++) limiter.TryRead("203.0.113.10");
        Assert.Empty(said);
    }

    [Fact]
    public void SaysSomethingOnceWhenTheBudgetIsNearlyGone()
    {
        var limiter = Limiter(global: 10);
        for (var i = 0; i < 9; i++) limiter.TryRead("203.0.113.10");
        Assert.Single(said);
        Assert.Contains("80% used", said[0]);
        Assert.Contains("all reads this hour", said[0]);
    }

    [Fact]
    public void SaysSomethingElseWhenItIsGone()
    {
        var limiter = Limiter(global: 10);
        for (var i = 0; i < 10; i++) limiter.TryRead("203.0.113.10");
        Assert.Equal(2, said.Count);
        Assert.Contains("fully used", said[1]);
        Assert.Contains("refused", said[1]);
    }

    [Fact]
    public void DoesNotRepeatItselfOnEveryRequestAfterThat()
    {
        // A warning on every request is a warning nobody reads.
        var limiter = Limiter(global: 10);
        for (var i = 0; i < 200; i++) limiter.TryRead("203.0.113.10");
        Assert.Equal(2, said.Count);
    }

    [Fact]
    public void NeverAnnouncesOnePersonReachingTheirOwnLimit()
    {
        // That is the limit working, and it is nobody else's business.
        var limiter = new PayslipReadLimiter(
            [new("this client", true, 2, TimeSpan.FromHours(1))], () => now, said.Add);
        for (var i = 0; i < 5; i++) limiter.TryRead("203.0.113.10");
        Assert.Empty(said);
    }

    [Fact]
    public void CanBeToldToSpeakUpEarlier()
    {
        var limiter = Limiter(global: 10, warnAt: 50);
        for (var i = 0; i < 5; i++) limiter.TryRead("203.0.113.10");
        Assert.Single(said);
        Assert.Contains("50% used", said[0]);
    }
}
