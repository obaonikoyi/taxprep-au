using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using TaxPrepAu.Api.Payslips;
using Xunit;

namespace TaxPrepAu.Api.Tests;

/*
 * What the assisted reader is allowed to hand back.
 *
 * The model's answer is data from outside, so it is treated like any other
 * untrusted input: only the twelve known fields survive, every one of them is a
 * string, and anything else becomes blank rather than being passed along. These
 * cover that boundary, which is the part that holds whatever the model does.
 *
 * The model call itself is not tested here — it needs a key and a network — and
 * the endpoint is switched off entirely unless one is configured, which the
 * last test pins down.
 */
public class PayslipReaderParseTests
{
    private static readonly string[] Fields = PayslipReaderEndpoint.Fields;

    [Fact]
    public void ReadsTheTwelveFields()
    {
        var facts = PayslipReaderEndpoint.Parse("""
            {"employer":"Kestrel Example Hospitality","periodStart":"2026-08-12","periodEnd":"2026-08-25",
             "payDate":"2026-08-27","gross":"1906.50","withheld":"295.00","deductions":"0.00","net":"1611.50",
             "super":"219.25","hours":"62.00","rate":"30.75","ordinary":"1906.50"}
            """);
        Assert.Equal("Kestrel Example Hospitality", facts["employer"]);
        Assert.Equal("30.75", facts["rate"]);
        Assert.Equal("62.00", facts["hours"]);
        Assert.Equal(Fields.Length, facts.Count);
    }

    [Fact]
    public void GivesEveryFieldEvenWhenTheAnswerOmitsThem()
    {
        // A blank field asks the person to fill it in. A missing key would leave
        // the browser reading undefined, so every field is always present.
        var facts = PayslipReaderEndpoint.Parse("""{"employer":"Kestrel Example Hospitality"}""");
        foreach (var field in Fields) Assert.True(facts.ContainsKey(field), $"missing {field}");
        Assert.Equal(string.Empty, facts["gross"]);
    }

    [Fact]
    public void KeepsNothingItWasNotAskedFor()
    {
        var facts = PayslipReaderEndpoint.Parse("""{"employer":"Kestrel","ytdGross":"48912.00","notes":"anything"}""");
        Assert.Equal(Fields.Length, facts.Count);
        Assert.DoesNotContain("ytdGross", facts.Keys);
        Assert.DoesNotContain("notes", facts.Keys);
    }

    [Fact]
    public void TurnsAnythingThatIsNotATextValueIntoABlank()
    {
        // Objects, arrays, nulls and booleans are not figures. Numbers are kept
        // as their text, because a model answering 1906.5 means 1906.5.
        var facts = PayslipReaderEndpoint.Parse("""
            {"employer":{"name":"Kestrel"},"gross":1906.50,"net":null,"withheld":["295.00"],"super":true}
            """);
        Assert.Equal(string.Empty, facts["employer"]);
        Assert.Equal(string.Empty, facts["net"]);
        Assert.Equal(string.Empty, facts["withheld"]);
        Assert.Equal(string.Empty, facts["super"]);
        Assert.Equal("1906.50", facts["gross"]);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not json at all")]
    [InlineData("[1,2,3]")]
    [InlineData("\"a string\"")]
    [InlineData("{\"employer\":")]
    public void AnswersBlanksRatherThanThrowingOnAnythingUnusable(string answer)
    {
        var facts = PayslipReaderEndpoint.Parse(answer);
        Assert.Equal(Fields.Length, facts.Count);
        Assert.All(Fields, field => Assert.Equal(string.Empty, facts[field]));
    }

    [Fact]
    public void RefusesAValueTooLongToBeAFigureOrAnEmployerName()
    {
        var facts = PayslipReaderEndpoint.Parse($$"""{"employer":"{{new string('x', 200)}}","gross":"1906.50"}""");
        Assert.Equal(string.Empty, facts["employer"]);
        Assert.Equal("1906.50", facts["gross"]);
    }

    [Fact]
    public void TrimsWhatItKeeps()
    {
        var facts = PayslipReaderEndpoint.Parse("""{"gross":"  1906.50  "}""");
        Assert.Equal("1906.50", facts["gross"]);
    }

    [Fact]
    public void NamesTheAppsOwnTwelveFields()
    {
        // If the app gains a field, this reader has to be told about it too.
        Assert.Equal(
            new[] { "employer", "periodStart", "periodEnd", "payDate", "gross", "withheld", "deductions", "net", "super", "hours", "rate", "ordinary" },
            Fields);
    }

    [Fact]
    public void TellsTheModelNeverToReadAYearToDateColumn()
    {
        // The single correctness rule this endpoint exists to hold. It is a
        // string, so nothing else can check it: this is the check.
        Assert.Contains("NEVER return a year-to-date", PayslipReaderEndpoint.SystemPrompt);
        Assert.Contains("YTD", PayslipReaderEndpoint.SystemPrompt);
        Assert.Contains("empty string", PayslipReaderEndpoint.SystemPrompt);
    }
}

public class PayslipReaderEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient client;
    private const string Endpoint = "/api/payslip/read";
    public PayslipReaderEndpointTests(WebApplicationFactory<Program> factory) => client = factory.CreateClient();

    /*
     * No key is configured in a test run, which is also true of every deployment
     * until someone sets one. The endpoint must say so plainly rather than fail,
     * because the app's answer to an unavailable reader is to offer manual entry.
     */
    [Fact]
    public async Task SaysItIsUnavailableWhenNoKeyIsConfigured()
    {
        var response = await client.PostAsJsonAsync(Endpoint, new { text = new string('x', 100) });
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, object>>();
        Assert.NotNull(body);
        Assert.Contains("available", body!.Keys);
    }

    [Fact]
    public async Task RefusesAnythingThatIsNotJson()
    {
        var response = await client.PostAsync(Endpoint, new StringContent("text", System.Text.Encoding.UTF8, "text/plain"));
        Assert.Equal(HttpStatusCode.UnsupportedMediaType, response.StatusCode);
    }
}
