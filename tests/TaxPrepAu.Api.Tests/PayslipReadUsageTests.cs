using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using TaxPrepAu.Api.Payslips;
using Xunit;

namespace TaxPrepAu.Api.Tests;

/*
 * What the reader has spent. Two things this must get right: it is not
 * reachable without the key, and it never names a caller.
 */
public class PayslipReadUsageSnapshotTests
{
    private DateTimeOffset now = new(2026, 9, 23, 9, 0, 0, TimeSpan.Zero);

    private PayslipReadLimiter Limiter(int perClient = 10, int global = 100) => new(
    [
        new("this client", true, perClient, TimeSpan.FromHours(1)),
        new("everyone this hour", false, global, TimeSpan.FromHours(1)),
        new("everyone today", false, global * 2, TimeSpan.FromDays(1)),
    ], () => now);

    [Fact]
    public void ReportsNothingUsedBeforeAnythingHappens()
    {
        var usage = Limiter().Usage();
        Assert.All(usage.Windows, window => Assert.Equal(0, window.Used));
        Assert.All(usage.Windows, window => Assert.Null(window.Resets));
        Assert.Equal(0, usage.Clients);
        Assert.Equal(0, usage.Busiest);
    }

    [Fact]
    public void ReportsOnlyTheGlobalWindows()
    {
        // A per-client window belongs to one caller and reporting it would mean
        // reporting which caller.
        var usage = Limiter().Usage();
        Assert.Equal(new[] { "everyone this hour", "everyone today" }, usage.Windows.Select(w => w.Name).ToArray());
    }

    [Fact]
    public void CountsWhatHasBeenRead()
    {
        var limiter = Limiter();
        for (var i = 0; i < 3; i++) limiter.TryRead("203.0.113.10");
        limiter.TryRead("203.0.113.11");
        var usage = limiter.Usage();
        Assert.All(usage.Windows, window => Assert.Equal(4, window.Used));
        Assert.Equal(2, usage.Clients);
    }

    [Fact]
    public void SaysWhenEachWindowResets()
    {
        var limiter = Limiter();
        limiter.TryRead("203.0.113.10");
        var usage = limiter.Usage();
        Assert.Equal(now.AddHours(1), usage.Windows.Single(w => w.Window == TimeSpan.FromHours(1)).Resets);
        Assert.Equal(now.AddDays(1), usage.Windows.Single(w => w.Window == TimeSpan.FromDays(1)).Resets);
    }

    [Fact]
    public void ForgetsAWindowOnceItHasPassed()
    {
        var limiter = Limiter();
        limiter.TryRead("203.0.113.10");
        now = now.AddHours(1).AddSeconds(1);
        var usage = limiter.Usage();
        Assert.Equal(0, usage.Windows.Single(w => w.Window == TimeSpan.FromHours(1)).Used);
        Assert.Equal(1, usage.Windows.Single(w => w.Window == TimeSpan.FromDays(1)).Used);
    }

    [Fact]
    public void SaysWhetherOneCallerIsTakingAnUnusualShareWithoutSayingWho()
    {
        var limiter = Limiter();
        for (var i = 0; i < 7; i++) limiter.TryRead("203.0.113.10");
        limiter.TryRead("203.0.113.11");
        var usage = limiter.Usage();
        Assert.Equal(2, usage.Clients);
        Assert.Equal(7, usage.Busiest);
        // The whole snapshot, serialised, must not contain anyone's address.
        var json = JsonSerializer.Serialize(usage);
        Assert.DoesNotContain("203.0.113", json);
    }

    [Fact]
    public void StopsCountingACallerWhoseWindowHasPassed()
    {
        var limiter = Limiter();
        limiter.TryRead("203.0.113.10");
        now = now.AddHours(1).AddSeconds(1);
        limiter.TryRead("203.0.113.11");
        Assert.Equal(1, limiter.Usage().Clients);
    }
}

public class PayslipReadUsageEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string Key = "a-usage-key-for-this-test";
    private readonly WebApplicationFactory<Program> factory;
    public PayslipReadUsageEndpointTests(WebApplicationFactory<Program> factory) => this.factory = factory;

    private HttpClient Client(params (string Key, string Value)[] settings) => factory
        .WithWebHostBuilder(builder => builder.ConfigureAppConfiguration((_, configuration) =>
            configuration.AddInMemoryCollection(settings.Select(s => new KeyValuePair<string, string?>(s.Key, s.Value)))))
        .CreateClient();

    private HttpClient Configured() => Client(("Payslips:ReadLimits:UsageKey", Key));

    private static async Task<JsonElement> Body(HttpResponseMessage response)
        => JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    [Fact]
    public async Task IsNotThereAtAllUntilAKeyIsConfigured()
    {
        var response = await Client().GetAsync($"{PayslipReadUsageEndpoint.Route}?key={Key}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData("")]
    [InlineData("wrong")]
    [InlineData("a-usage-key-for-this-tes")]
    [InlineData("a-usage-key-for-this-testt")]
    public async Task AnswersTheSameWayToAWrongKeyAsToNoEndpointAtAll(string offered)
    {
        // Not 401: a different answer for a wrong key would confirm the path is
        // there and worth guessing at.
        var response = await Configured().GetAsync($"{PayslipReadUsageEndpoint.Route}?key={offered}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AnswersToAKeyInTheQueryStringSoItCanBeOpenedInABrowser()
    {
        var response = await Configured().GetAsync($"{PayslipReadUsageEndpoint.Route}?key={Key}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task AnswersToABearerToken()
    {
        var client = Configured();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", Key);
        var response = await client.GetAsync(PayslipReadUsageEndpoint.Route);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task IsNeverCached()
    {
        var response = await Configured().GetAsync($"{PayslipReadUsageEndpoint.Route}?key={Key}");
        Assert.Contains("no-store", response.Headers.CacheControl?.ToString() ?? string.Empty);
    }

    [Fact]
    public async Task ReportsEveryGlobalWindowWithWhatIsLeft()
    {
        var body = await Body(await Configured().GetAsync($"{PayslipReadUsageEndpoint.Route}?key={Key}"));
        var windows = body.GetProperty("windows").EnumerateArray().ToList();
        Assert.Equal(2, windows.Count);
        foreach (var window in windows)
        {
            Assert.False(string.IsNullOrWhiteSpace(window.GetProperty("name").GetString()));
            Assert.True(window.GetProperty("limit").GetInt32() > 0);
            Assert.Equal(0, window.GetProperty("used").GetInt32());
            Assert.Equal(window.GetProperty("limit").GetInt32(), window.GetProperty("left").GetInt32());
        }
    }

    [Fact]
    public async Task SaysWhetherTheReaderIsEvenSwitchedOn()
    {
        var off = await Body(await Configured().GetAsync($"{PayslipReadUsageEndpoint.Route}?key={Key}"));
        Assert.Equal("off", off.GetProperty("reader").GetString());

        var on = await Body(await Client(
            ("Payslips:ReadLimits:UsageKey", Key),
            ("Anthropic:ApiKey", "not-a-real-key-and-never-used")).GetAsync($"{PayslipReadUsageEndpoint.Route}?key={Key}"));
        Assert.Equal("on", on.GetProperty("reader").GetString());
    }

    [Fact]
    public async Task EstimatesWhatAFullDayWouldCost()
    {
        var body = await Body(await Client(
            ("Payslips:ReadLimits:UsageKey", Key),
            ("Payslips:ReadLimits:GlobalPerDay", "150"),
            ("Payslips:ReadLimits:MaxCostCentsPerRead", "8")).GetAsync($"{PayslipReadUsageEndpoint.Route}?key={Key}"));
        var spend = body.GetProperty("estimatedSpend");
        Assert.Equal(0m, spend.GetProperty("soFarUsd").GetDecimal());
        Assert.Equal(12.00m, spend.GetProperty("ifFullyUsedUsd").GetDecimal());
        Assert.Contains("not a bill", spend.GetProperty("note").GetString());
    }

    [Fact]
    public async Task CountsCallersWithoutNamingOne()
    {
        var body = await Body(await Configured().GetAsync($"{PayslipReadUsageEndpoint.Route}?key={Key}"));
        var callers = body.GetProperty("callers");
        Assert.Equal(0, callers.GetProperty("counted").GetInt32());
        Assert.Equal(0, callers.GetProperty("busiest").GetInt32());
        // "callers" is a count. Whatever else this answer grows, it must not
        // grow a field that carries where a request came from.
        foreach (var name in Names(body))
            foreach (var forbidden in new[] { "address", "addr", "remote", "forwarded", "connecting", "host" })
                Assert.False(name.Contains(forbidden, StringComparison.OrdinalIgnoreCase), $"{name} names where a request came from");
    }

    [Fact]
    public async Task NeverPutsAnAddressInTheAnswer()
    {
        var body = await Body(await Configured().GetAsync($"{PayslipReadUsageEndpoint.Route}?key={Key}"));
        Assert.DoesNotMatch(@"\b\d{1,3}(\.\d{1,3}){3}\b", body.ToString());
        Assert.DoesNotMatch(@"[0-9a-fA-F]{1,4}:[0-9a-fA-F]{0,4}:", body.ToString());
    }

    /// <summary>Every property name in the answer, at any depth.</summary>
    private static IEnumerable<string> Names(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Object)
            foreach (var property in element.EnumerateObject())
            {
                yield return property.Name;
                foreach (var nested in Names(property.Value)) yield return nested;
            }
        else if (element.ValueKind == JsonValueKind.Array)
            foreach (var item in element.EnumerateArray())
                foreach (var nested in Names(item)) yield return nested;
    }
}
