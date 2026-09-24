using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using TaxPrepAu.Api.Payslips;
using Xunit;

namespace TaxPrepAu.Api.Tests;

/*
 * The server's share of reading a bank statement: narrow the answer to the
 * shape the browser expects, and nothing else. The arithmetic that decides
 * whether any of it is believed happens in the browser, beside the rest of the
 * statement checks.
 */
public class StatementParseTests
{
    private static JsonElement Parsed(string json)
        => JsonSerializer.SerializeToElement(StatementReaderEndpoint.Parse(json));

    [Fact]
    public void ReadsAStatementAndItsRows()
    {
        var parsed = Parsed("""
            {"opening":"1000.00","closing":"1250.50","printedDebits":"149.50","printedCredits":"400.00",
             "from":"2026-07-01","to":"2026-07-31","why":"",
             "rows":[{"date":"2026-07-02","description":"WOOLWORTHS 1234","amount":"-49.50","balance":"950.50"}]}
            """);
        Assert.Equal("1000.00", parsed.GetProperty("opening").GetString());
        var rows = parsed.GetProperty("rows").EnumerateArray().ToList();
        Assert.Single(rows);
        Assert.Equal("WOOLWORTHS 1234", rows[0].GetProperty("description").GetString());
        Assert.Equal("-49.50", rows[0].GetProperty("amount").GetString());
    }

    [Fact]
    public void AnswersAnEmptyStatementRatherThanThrowingOnAnythingUnusable()
    {
        foreach (var answer in new[] { "", "   ", "not json", "[1,2,3]", "\"text\"", "{\"rows\":" })
        {
            var parsed = Parsed(answer);
            Assert.Empty(parsed.GetProperty("rows").EnumerateArray());
            Assert.False(string.IsNullOrEmpty(parsed.GetProperty("why").GetString()));
        }
    }

    [Fact]
    public void DropsRowsThatAreNotObjects()
    {
        var parsed = Parsed("""{"rows":[1,"two",null,{"date":"2026-07-02","description":"KEPT","amount":"-1.00","balance":""}]}""");
        var rows = parsed.GetProperty("rows").EnumerateArray().ToList();
        Assert.Single(rows);
        Assert.Equal("KEPT", rows[0].GetProperty("description").GetString());
    }

    [Fact]
    public void KeepsNothingItWasNotAskedFor()
    {
        var parsed = Parsed("""{"rows":[{"date":"2026-07-02","description":"D","amount":"-1.00","balance":"","accountNumber":"062-000 12345678"}],"bsb":"062-000"}""");
        Assert.False(parsed.TryGetProperty("bsb", out _));
        Assert.False(parsed.GetProperty("rows").EnumerateArray().First().TryGetProperty("accountNumber", out _));
    }

    [Fact]
    public void StopsAtTheRowsItWillLookAt()
    {
        var many = string.Join(',', Enumerable.Range(0, 500).Select(i => $$"""{"date":"2026-07-02","description":"ROW {{i}}","amount":"-1.00","balance":""}"""));
        Assert.Equal(StatementReaderEndpoint.MaximumRows, Parsed($$"""{"rows":[{{many}}]}""").GetProperty("rows").GetArrayLength());
    }

    [Fact]
    public void TellsTheModelItIsATranscriberAndNotAnAnalyst()
    {
        // Everything this endpoint is safe to do rests on it copying rather than
        // working anything out, because the checksum only catches arithmetic.
        Assert.Contains("You are a transcriber, not an analyst", StatementReaderEndpoint.SystemPrompt);
        Assert.Contains("Never calculate a balance", StatementReaderEndpoint.SystemPrompt);
        Assert.Contains("Never invent, merge, split or reorder a transaction", StatementReaderEndpoint.SystemPrompt);
        Assert.Contains("Never leave a transaction out", StatementReaderEndpoint.SystemPrompt);
        Assert.Contains("Do not tidy, expand,", StatementReaderEndpoint.SystemPrompt);
        Assert.Contains("categorise or summarise it", StatementReaderEndpoint.SystemPrompt);
    }

    [Fact]
    public void TellsTheModelItsWorkIsCheckedAgainstTheStatementsOwnArithmetic()
        => Assert.Contains("the whole transcription is discarded", StatementReaderEndpoint.SystemPrompt);
}

public class StatementEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> factory;
    private const string Endpoint = "/api/statement/read";
    public StatementEndpointTests(WebApplicationFactory<Program> factory) => this.factory = factory;

    private HttpClient Client(params (string Key, string Value)[] settings) => factory
        .WithWebHostBuilder(builder => builder.ConfigureAppConfiguration((_, configuration) =>
            configuration.AddInMemoryCollection(settings.Select(s => new KeyValuePair<string, string?>(s.Key, s.Value)))))
        .CreateClient();

    [Fact]
    public async Task SaysItIsUnavailableWhenNoKeyIsConfigured()
    {
        var response = await Client().PostAsJsonAsync(Endpoint, new { text = new string('x', 500) });
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Contains("CSV export", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task IsTheMostExpensiveThingThisAppReads()
    {
        // Pages in and hundreds of rows out. A budget with nine reads left
        // cannot pay for one, and that is the point of charging it properly.
        Assert.True(StatementReaderEndpoint.BudgetCost > ContractReaderEndpoint.BudgetCost);
        var response = await Client(
            ("Anthropic:ApiKey", "not-real-and-never-used"),
            ("Payslips:ReadLimits:GlobalPerHour", "9")).PostAsJsonAsync(Endpoint, new { text = new string('x', 500) });
        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
    }

    [Fact]
    public async Task RefusesTextTooShortToBeAStatement()
    {
        var response = await Client(("Anthropic:ApiKey", "not-real-and-never-used"))
            .PostAsJsonAsync(Endpoint, new { text = "one transaction" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
