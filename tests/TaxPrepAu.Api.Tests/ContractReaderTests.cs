using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using TaxPrepAu.Api.Payslips;
using Xunit;

namespace TaxPrepAu.Api.Tests;

/*
 * What a contract reading is allowed to hand back.
 *
 * A wrong rate here is worse than a wrong figure on a payslip: it becomes the
 * baseline every payslip is compared against, so it produces a run of
 * confident, specific, wrong findings that the person may send their employer.
 * These cover the boundary that stands between a model's answer and that.
 */
public class ContractParseTests
{
    [Fact]
    public void ReadsAPlainHourlyRate()
    {
        var facts = ContractReaderEndpoint.Parse("""
            {"employer":"Kestrel Example Hospitality","basis":"hourly","amount":"32.50","weeklyHours":"",
             "from":"2026-07-01","quote":"4.1  The ordinary hourly rate is $32.50 per hour, effective 1 July 2026.","why":""}
            """);
        Assert.Equal("32.50", facts["amount"]);
        Assert.Equal("hourly", facts["basis"]);
        Assert.Equal("2026-07-01", facts["from"]);
    }

    [Fact]
    public void KeepsOnlyTheTwoBasesThisAppUnderstands()
    {
        foreach (var basis in new[] { "weekly", "daily", "fortnightly", "HOURLY", "per hour", "" })
            Assert.Equal(string.Empty, ContractReaderEndpoint.Parse($$"""{"basis":"{{basis}}","amount":"32.50"}""")["basis"]);
        Assert.Equal("annual", ContractReaderEndpoint.Parse("""{"basis":"annual"}""")["basis"]);
    }

    [Fact]
    public void GivesEveryFieldEvenWhenTheAnswerOmitsThem()
    {
        var facts = ContractReaderEndpoint.Parse("""{"amount":"32.50"}""");
        foreach (var field in ContractReaderEndpoint.Fields) Assert.True(facts.ContainsKey(field), $"missing {field}");
    }

    [Fact]
    public void KeepsNothingItWasNotAskedFor()
    {
        var facts = ContractReaderEndpoint.Parse("""{"amount":"32.50","superannuation":"12%","signatory":"A. Manager"}""");
        Assert.Equal(ContractReaderEndpoint.Fields.Length, facts.Count);
        Assert.DoesNotContain("signatory", facts.Keys);
    }

    [Theory]
    [InlineData("")]
    [InlineData("not json")]
    [InlineData("[1,2,3]")]
    [InlineData("{\"amount\":")]
    public void AnswersBlanksRatherThanThrowingOnAnythingUnusable(string answer)
        => Assert.All(ContractReaderEndpoint.Fields, field => Assert.Equal(string.Empty, ContractReaderEndpoint.Parse(answer)[field]));

    [Fact]
    public void TellsTheModelToRefuseALoadedRate()
    {
        // The single most likely way to be confidently wrong: "$25.00 per hour
        // plus 25% casual loading" is neither 25.00 nor 31.25.
        Assert.Contains("casual loading", ContractReaderEndpoint.SystemPrompt);
        Assert.Contains("is NOT a rate of 25.00", ContractReaderEndpoint.SystemPrompt);
        Assert.Contains("classification", ContractReaderEndpoint.SystemPrompt);
        Assert.Contains("REFUSING IS THE MAIN THING YOU DO", ContractReaderEndpoint.SystemPrompt);
    }

    [Fact]
    public void TellsTheModelToQuoteTheSentenceWordForWord()
        => Assert.Contains("character for character", ContractReaderEndpoint.SystemPrompt);
}

/*
 * The defence the payslip reader does not need: a rate is believed only when
 * the sentence it came from is in the contract.
 */
public class ContractQuoteTests
{
    private const string Contract = """
        4. Pay
        4.1  The ordinary hourly rate is $32.50 per hour, effective 1 July 2026.
        4.2  Pay is made fortnightly, in arrears, by bank transfer.
        """;

    private static Dictionary<string, string> Answer(string amount, string quote) => ContractReaderEndpoint.Parse(
        $$"""{"employer":"Kestrel","basis":"hourly","amount":"{{amount}}","weeklyHours":"","from":"2026-07-01","quote":"{{quote}}","why":""}""");

    [Fact]
    public void BelievesARateWhoseSentenceIsInTheContract()
    {
        var facts = ContractReaderEndpoint.Verified(Answer("32.50", "The ordinary hourly rate is $32.50 per hour, effective 1 July 2026."), Contract);
        Assert.Equal("32.50", facts["amount"]);
        Assert.Equal(string.Empty, facts["why"]);
    }

    [Fact]
    public void ThrowsAwayARateWhoseSentenceIsNotThere()
    {
        // The failure that matters. An invented rate now also requires an
        // invented sentence that happens to be in the document.
        var facts = ContractReaderEndpoint.Verified(Answer("45.00", "The ordinary hourly rate is $45.00 per hour."), Contract);
        Assert.Equal(string.Empty, facts["amount"]);
        Assert.Equal(string.Empty, facts["basis"]);
        Assert.Equal(string.Empty, facts["from"]);
        Assert.Contains("could not be found in your contract", facts["why"]);
    }

    [Fact]
    public void ThrowsAwayAParaphrase()
    {
        // A tidied-up sentence is what a rate that was inferred rather than
        // read looks like.
        var facts = ContractReaderEndpoint.Verified(Answer("32.50", "The hourly rate is $32.50 from 1 July 2026."), Contract);
        Assert.Equal(string.Empty, facts["amount"]);
    }

    [Fact]
    public void ForgivesOnlyHowAPdfBreaksItsLines()
    {
        // A PDF breaks a line where the page ends, not where the sentence does.
        var wrapped = Contract.Replace("$32.50 per hour,", "$32.50 per\n   hour,");
        var facts = ContractReaderEndpoint.Verified(Answer("32.50", "The ordinary hourly rate is $32.50 per hour, effective 1 July 2026."), wrapped);
        Assert.Equal("32.50", facts["amount"]);
    }

    [Fact]
    public void RefusesAQuoteTooShortToMeanAnything()
    {
        foreach (var quote in new[] { "", "$32.50", "rate" })
            Assert.Equal(string.Empty, ContractReaderEndpoint.Verified(Answer("32.50", quote), Contract)["amount"]);
    }

    [Fact]
    public void LeavesARefusalAlone()
    {
        // Nothing to verify, and the reason must survive to reach the person.
        var refused = ContractReaderEndpoint.Parse("""{"amount":"","why":"The rate depends on a classification this document does not state."}""");
        var facts = ContractReaderEndpoint.Verified(refused, Contract);
        Assert.Contains("classification", facts["why"]);
    }
}

public class ContractEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> factory;
    private const string Endpoint = "/api/contract/read";
    public ContractEndpointTests(WebApplicationFactory<Program> factory) => this.factory = factory;

    private HttpClient Client(params (string Key, string Value)[] settings) => factory
        .WithWebHostBuilder(builder => builder.ConfigureAppConfiguration((_, configuration) =>
            configuration.AddInMemoryCollection(settings.Select(s => new KeyValuePair<string, string?>(s.Key, s.Value)))))
        .CreateClient();

    [Fact]
    public async Task SaysItIsUnavailableWhenNoKeyIsConfigured()
    {
        var response = await Client().PostAsJsonAsync(Endpoint, new { text = new string('x', 500) });
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
    }

    [Fact]
    public async Task RefusesTextTooShortToBeAContract()
    {
        var response = await Client(("Anthropic:ApiKey", "not-real-and-never-used"))
            .PostAsJsonAsync(Endpoint, new { text = "The rate is $32.50." });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CountsAgainstTheSameBudgetAsAPayslip()
    {
        var response = await Client(
            ("Anthropic:ApiKey", "not-real-and-never-used"),
            ("Payslips:ReadLimits:GlobalPerHour", "0")).PostAsJsonAsync(Endpoint, new { text = new string('x', 500) });
        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
    }

    [Fact]
    public async Task CostsMoreThanOnePayslipBecauseItIsLonger()
    {
        // A contract is several pages where a payslip is one. A budget with two
        // reads left cannot pay for one.
        var response = await Client(
            ("Anthropic:ApiKey", "not-real-and-never-used"),
            ("Payslips:ReadLimits:GlobalPerHour", "2")).PostAsJsonAsync(Endpoint, new { text = new string('x', 500) });
        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        Assert.True(ContractReaderEndpoint.BudgetCost > 1);
    }
}

/*
 * Penalty rates a contract states for a kind of day.
 *
 * Everything the ordinary rate's tests are about applies here and harder. An
 * ordinary rate that is wrong produces one baseline nobody may act on; a
 * penalty rate that is wrong produces a specific claim about a specific
 * Saturday — "your contract says time and a half and you were paid 1.4" —
 * about a term that may never have been in the contract at all.
 */
public class ContractPenaltyTests
{
    private const string Contract = """
        4. Pay
        4.1  The ordinary hourly rate is $32.50 per hour, effective 1 July 2026.
        4.2  Work performed on a Saturday is paid at time and a half.
        4.3  Work performed on a Sunday is paid at $58.50 per hour.
        4.4  Penalty rates for public holidays apply as per the award.
        """;

    private static string Entry(string kind, string multiplier, string amount, string quote)
        => $$"""{"kind":"{{kind}}","multiplier":"{{multiplier}}","amount":"{{amount}}","quote":"{{quote}}"}""";
    private static List<ContractPenalty> Parse(params string[] entries)
        => ContractReaderEndpoint.ParsePenalties($$"""{"amount":"32.50","penalties":[{{string.Join(",", entries)}}]}""");

    [Fact]
    public void ReadsAMultiplierAndAFlatRateSideBySide()
    {
        var penalties = Parse(
            Entry("saturday", "1.5", "", "4.2  Work performed on a Saturday is paid at time and a half."),
            Entry("sunday", "", "58.50", "4.3  Work performed on a Sunday is paid at $58.50 per hour."));
        Assert.Equal(2, penalties.Count);
        Assert.Equal(new ContractPenalty("saturday", "1.5", "", "4.2  Work performed on a Saturday is paid at time and a half."), penalties[0]);
        Assert.Equal("58.50", penalties[1].Amount);
        Assert.Equal(string.Empty, penalties[1].Multiplier);
    }

    [Fact]
    public void KeepsOnlyTheKindsThisAppHasARuleFor()
    {
        // A casual loading is deliberately not a kind: it applies to every
        // ordinary hour, so it changes what the ordinary rate is rather than
        // sitting on top of it for one day.
        Assert.DoesNotContain("casual", ContractReaderEndpoint.PenaltyKinds);
        Assert.Empty(Parse(Entry("casual", "1.25", "", "Casual employees are paid a 25% loading.")));
        Assert.Empty(Parse(Entry("birthday", "2", "", "4.2  Work performed on a Saturday is paid at time and a half.")));
    }

    [Theory]
    // Both figures: the contract cannot have meant a multiplier AND a flat rate.
    [InlineData("1.5", "58.50")]
    // Neither: nothing to compare a payslip line against.
    [InlineData("", "")]
    // Not plain numbers. A range or a word is exactly what an inferred rate looks like.
    [InlineData("time and a half", "")]
    [InlineData("1.5x", "")]
    [InlineData("", "$58.50")]
    [InlineData("", "58.50 to 62.00")]
    [InlineData("0", "")]
    [InlineData("-1.5", "")]
    public void DropsAnEntryThatDoesNotStateOneUsableFigure(string multiplier, string amount)
        => Assert.Empty(Parse(Entry("saturday", multiplier, amount, "4.2  Work performed on a Saturday is paid at time and a half.")));

    [Fact]
    public void DropsAnEntryWithNoQuoteAtAll()
        => Assert.Empty(Parse(Entry("saturday", "1.5", "", "")));

    [Fact]
    public void KeepsOnlyTheFirstOfARepeatedKind()
    {
        var penalties = Parse(
            Entry("saturday", "1.5", "", "4.2  Work performed on a Saturday is paid at time and a half."),
            Entry("saturday", "2", "", "4.3  Work performed on a Sunday is paid at $58.50 per hour."));
        Assert.Single(penalties);
        Assert.Equal("1.5", penalties[0].Multiplier);
    }

    [Theory]
    [InlineData("")]
    [InlineData("not json")]
    [InlineData("{}")]
    [InlineData("""{"penalties":"none"}""")]
    [InlineData("""{"penalties":[null,3,"saturday"]}""")]
    [InlineData("[]")]
    public void AnswersAnEmptyListRatherThanThrowingOnAnythingUnusable(string answer)
        => Assert.Empty(ContractReaderEndpoint.ParsePenalties(answer));

    [Fact]
    public void BelievesAPenaltyOnlyWhenItsSentenceIsInTheContract()
    {
        var good = Parse(Entry("saturday", "1.5", "", "4.2  Work performed on a Saturday is paid at time and a half."));
        Assert.Single(ContractReaderEndpoint.VerifiedPenalties(good, Contract));

        // A line break where the page ended, not where the sentence did.
        var wrapped = Parse(Entry("saturday", "1.5", "", "4.2  Work performed on a Saturday\\n     is paid at time and a half."));
        Assert.Single(ContractReaderEndpoint.VerifiedPenalties(wrapped, Contract));
    }

    [Fact]
    public void ThrowsAwayEveryPenaltyWhenOneSentenceIsNotInTheContract()
    {
        // 4.4 states no figure, so "time and a half on public holidays" is a
        // sentence the model supplied rather than read. One such sentence
        // discards the others: an answer that will invent one has not earned
        // belief about the rest.
        var mixed = Parse(
            Entry("saturday", "1.5", "", "4.2  Work performed on a Saturday is paid at time and a half."),
            Entry("publicHoliday", "2.5", "", "4.4  Work on a public holiday is paid at double time and a half."));
        Assert.Equal(2, mixed.Count);
        Assert.Empty(ContractReaderEndpoint.VerifiedPenalties(mixed, Contract));
    }

    [Fact]
    public void TellsTheModelWhatAPenaltyIsAndIsNot()
    {
        var prompt = ContractReaderEndpoint.SystemPrompt;
        Assert.Contains("A casual loading is not a penalty rate", prompt);
        Assert.Contains("Exactly one of multiplier and amount", prompt);
        Assert.Contains("Leave a penalty out rather than working one out", prompt);
        Assert.Contains("as per the award", prompt);
    }

    [Fact]
    public void OffersTheModelOnlyTheDaysItCanAct0n()
        => Assert.Equal(["saturday", "sunday", "publicHoliday", "evening", "night", "overtime"], ContractReaderEndpoint.PenaltyKinds);
}
