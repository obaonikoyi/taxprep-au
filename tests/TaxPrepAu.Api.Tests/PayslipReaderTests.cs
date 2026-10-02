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

/*
 * The earnings table an assisted reading brings back.
 *
 * A payslip whose layout nothing here documents goes through the model, and
 * until now that meant its table was lost — on a shift worker's payslip, most
 * of the pay. The table can be read, but it cannot be trusted: nobody checks
 * thirty transcribed numbers by hand. So the document checks them.
 */
public class PayslipEarningsLineTests
{
    private const string Text = """
        SALARY & WAGES        RATE       THIS PAY      YTD
        Ordinary Hours        8.0000     $45.2800      $362.24      $2,930.99
        Afternoon Hours      38.5000     $49.8080    $1,917.61      $9,424.25
        TOTAL                                        $4,018.60     $22,714.86
        """;

    private static string Entry(string label, string hours, string rate, string amount)
        => $$"""{"label":"{{label}}","hours":"{{hours}}","rate":"{{rate}}","amount":"{{amount}}"}""";
    private static List<PayslipEarningsLine> Parse(params string[] entries)
        => PayslipReaderEndpoint.ParseLines($$"""{"gross":"4018.60","lines":[{{string.Join(",", entries)}}]}""");

    private static readonly string Ordinary = Entry("Ordinary Hours", "8.0000", "45.2800", "362.24");
    private static readonly string Afternoon = Entry("Afternoon Hours", "38.5000", "49.8080", "1917.61");

    [Fact]
    public void ReadsARowWithEveryDecimalPlaceThePayslipPrints()
    {
        var lines = Parse(Ordinary, Afternoon);
        Assert.Equal(2, lines.Count);
        Assert.Equal(new PayslipEarningsLine("Ordinary Hours", "8.0000", "45.2800", "362.24"), lines[0]);
        // Four places, because 38.5 x 49.81 is not 1917.61 and the row would
        // stop adding up.
        Assert.Equal("49.8080", lines[1].Rate);
    }

    [Fact]
    public void KeepsARowThatStatesAnAmountAndNothingElse()
    {
        // A bonus or an allowance prints no hours and no rate. It is a row the
        // arithmetic cannot check, which is not the same as a row that is wrong.
        var lines = Parse(Entry("Bonus", "", "", "500.00"));
        Assert.Single(lines);
        Assert.Equal(string.Empty, lines[0].Hours);
    }

    [Theory]
    [InlineData("", "8.0000", "45.2800", "362.24")]          // no label is not a row
    [InlineData("Ordinary Hours", "8.0000", "45.2800", "")]  // no amount is not a row
    [InlineData("Ordinary Hours", "8.0000", "45.2800", "$362.24")]
    [InlineData("Ordinary Hours", "8.0000", "45.2800", "362.24 to 400.00")]
    [InlineData("Ordinary Hours", "8.0000", "45.2800", "three hundred")]
    public void DropsARowThatDoesNotStateAPlainAmount(string label, string hours, string rate, string amount)
        => Assert.Empty(Parse(Entry(label, hours, rate, amount)));

    [Fact]
    public void BlanksAFigureThatIsNotPlainWithoutLosingTheRow()
    {
        // The amount carries the row; a rate that came back with a symbol is
        // simply not read, and the row stays as one the arithmetic skips.
        var lines = Parse(Entry("Ordinary Hours", "8.0000", "$45.28", "362.24"));
        Assert.Single(lines);
        Assert.Equal(string.Empty, lines[0].Rate);
        Assert.Equal("362.24", lines[0].Amount);
    }

    [Theory]
    [InlineData("")]
    [InlineData("not json")]
    [InlineData("{}")]
    [InlineData("""{"lines":"none"}""")]
    [InlineData("""{"lines":[null,7,"Ordinary"]}""")]
    [InlineData("[]")]
    public void AnswersAnEmptyTableRatherThanThrowingOnAnythingUnusable(string answer)
        => Assert.Empty(PayslipReaderEndpoint.ParseLines(answer));

    [Fact]
    public void BelievesATableOnlyWhenEveryFigureIsInThePayslip()
    {
        var good = Parse(Ordinary, Afternoon);
        Assert.Equal(2, PayslipReaderEndpoint.VerifiedLines(good, Text).Count);
    }

    [Fact]
    public void MatchesAcrossTheSymbolsAndSeparatorsAPayslipPrints()
    {
        // The page says "$1,917.61"; the answer says "1917.61".
        Assert.Single(PayslipReaderEndpoint.VerifiedLines(Parse(Afternoon), Text));
    }

    [Fact]
    public void ThrowsAwayTheWholeTableWhenOneFigureIsNotInThePayslip()
    {
        // A Saturday row this payslip never printed. Half a table is worse than
        // none: the missing half would read as pay that was never itemised.
        var invented = Parse(Ordinary, Afternoon, Entry("Saturday Hours", "7.5000", "63.3920", "475.44"));
        Assert.Equal(3, invented.Count);
        Assert.Empty(PayslipReaderEndpoint.VerifiedLines(invented, Text));
    }

    [Fact]
    public void ThrowsItAwayForAMisreadRateToo()
    {
        // 49.81 instead of 49.8080 — the row would then fail its own arithmetic
        // and read as a discrepancy on the payslip rather than a misreading.
        var rounded = Parse(Ordinary, Entry("Afternoon Hours", "38.5000", "49.81", "1917.61"));
        Assert.Empty(PayslipReaderEndpoint.VerifiedLines(rounded, Text));
    }

    [Fact]
    public void AnEmptyTableIsNotAFailure()
        => Assert.Empty(PayslipReaderEndpoint.VerifiedLines([], Text));

    [Fact]
    public void TellsTheModelTheTableIsCheckedAndWhatBelongsInIt()
    {
        var prompt = PayslipReaderEndpoint.SystemPrompt;
        Assert.Contains("YOUR TABLE IS CHECKED", prompt);
        Assert.Contains("an omitted row is safer than an invented one", prompt);
        Assert.Contains("Never the table's own total row", prompt);
        Assert.Contains("A rate of 49.8080 is not 49.81", prompt);
    }
}

/*
 * What the document is, and who it is made out to.
 *
 * The guard these replace was "all twelve fields came back empty", which stops
 * nonsense and nothing else. An ATO notice of assessment is not nonsense — it
 * carries a name, an ABN, dates and dollar amounts, which is exactly what a
 * payslip reader hunts for, and its figures cover a year. Read as a payslip it
 * counts a year as a fortnight.
 */
public class PayslipDocumentKindTests
{
    private static string Answer(string kind) => $$"""{"documentKind":"{{kind}}","paidTo":"A. Person","gross":"100.00"}""";

    [Theory]
    [InlineData("payslip")]
    [InlineData("taxReturn")]
    [InlineData("annualIncomeStatement")]
    [InlineData("bankStatement")]
    [InlineData("employmentContract")]
    [InlineData("invoice")]
    [InlineData("other")]
    public void ReadsEveryKindItOffers(string kind)
        => Assert.Equal(kind, PayslipReaderEndpoint.ParseDocumentKind(Answer(kind)));

    [Theory]
    [InlineData("payslipish")]
    [InlineData("PAYSLIP")]
    [InlineData("medicalCertificate")]
    [InlineData("")]
    public void CallsAnythingItHasNoSentenceForOther(string kind)
        => Assert.Equal("other", PayslipReaderEndpoint.ParseDocumentKind(Answer(kind)));

    [Theory]
    [InlineData("")]
    [InlineData("not json")]
    [InlineData("{}")]
    [InlineData("""{"documentKind":7}""")]
    [InlineData("""{"documentKind":null}""")]
    [InlineData("[]")]
    public void AnswersOtherRatherThanBlankWhenNothingUsableComesBack(string json)
    {
        // Never blank: the browser has to have an answer for every file, and
        // "other" is the answer that asks the person rather than assuming.
        Assert.Equal("other", PayslipReaderEndpoint.ParseDocumentKind(json));
    }

    [Fact]
    public void ReadsTheNameTheDocumentIsMadeOutTo()
        => Assert.Equal("A. Person", PayslipReaderEndpoint.ParsePaidTo(Answer("payslip")));

    [Fact]
    public void AnswersNoNameRatherThanAMisreadOne()
    {
        Assert.Equal(string.Empty, PayslipReaderEndpoint.ParsePaidTo("""{"paidTo":""}"""));
        Assert.Equal(string.Empty, PayslipReaderEndpoint.ParsePaidTo("{}"));
        Assert.Equal(string.Empty, PayslipReaderEndpoint.ParsePaidTo("""{"paidTo":42}"""));
        // A "name" this long is some other field that was misread.
        Assert.Equal(string.Empty, PayslipReaderEndpoint.ParsePaidTo($$"""{"paidTo":"{{new string('a', 121)}}"}"""));
    }

    [Fact]
    public void TellsTheModelToAnswerTheKindHonestlyAndWhyItMatters()
    {
        var prompt = PayslipReaderEndpoint.SystemPrompt;
        Assert.Contains("WHAT IS THIS DOCUMENT?", prompt);
        Assert.Contains("a document is what it is", prompt);
        // The reason a tax return is the dangerous one.
        Assert.Contains("cover a FINANCIAL YEAR rather than a pay period", prompt);
        // An unplaceable payslip must still be read, or the override is useless.
        Assert.Contains("still fill in whatever the document does state", prompt);
    }

    [Fact]
    public void TellsTheModelTheNameIsForComparisonOnly()
    {
        var prompt = PayslipReaderEndpoint.SystemPrompt;
        Assert.Contains("WHO IS IT MADE OUT TO?", prompt);
        Assert.Contains("never stored, never shown", prompt);
    }

    [Fact]
    public void OffersOnlyTheKindsTheAppHasASentenceFor()
        => Assert.Equal(
            ["payslip", "taxReturn", "annualIncomeStatement", "bankStatement", "employmentContract", "invoice", "other"],
            PayslipReaderEndpoint.DocumentKinds);
}
