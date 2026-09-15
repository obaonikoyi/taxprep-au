using System.Net;
using System.Net.Http.Json;
using System.Text;
using Microsoft.AspNetCore.Mvc.Testing;
using TaxPrepAu.Api.Expenses;
using Xunit;

namespace TaxPrepAu.Api.Tests;

public class ExpenseReviewTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient client;
    private const string Endpoint = "/api/expenses/review";
    private static ExpenseInput Phone => new("phone", 600, 40, "Work calls", "Usage diary", "none", "available", "Sample bills");
    public ExpenseReviewTests(WebApplicationFactory<Program> factory) => client = factory.CreateClient(
        new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });
    private Task<HttpResponseMessage> Review(params ExpenseInput?[] items) => client.PostAsJsonAsync(Endpoint, new ExpenseReviewRequest(items.ToList()));

    [Fact]
    public async Task Sample_separates_entered_amounts_work_portions_and_evidence_gaps()
    {
        using var response = await Review(Phone,
            Phone with { Category = "travel", Amount = 72.60m, WorkUsePercent = 100, Evidence = "missing", EvidenceReference = "" },
            Phone with { Category = "protective-clothing", Amount = 120, WorkUsePercent = 100, Reimbursement = "full" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(response.Headers.CacheControl?.NoStore);
        var result = (await response.Content.ReadFromJsonAsync<ExpenseReviewResult>())!;
        Assert.Equal(792.60m, result.EnteredTotal);
        Assert.Equal(312.60m, result.WorkPortionTotal);
        Assert.Equal(1, result.AttentionCount);
        Assert.Equal(0, result.UnresolvedCount);
        Assert.Equal("details-recorded", result.Items.Single(x => x.Category == "phone").Status);
        Assert.Contains("supporting evidence", Assert.Single(result.Items.Single(x => x.Category == "travel").Actions));
        Assert.Equal(0m, result.Items.Single(x => x.Category == "protective-clothing").WorkPortion);
    }

    [Fact]
    public async Task Rounds_each_item_before_summing_with_decimal_arithmetic()
    {
        using var response = await Review(Phone with { Amount = .05m, WorkUsePercent = 10 },
            Phone with { Category = "travel", Amount = .05m, WorkUsePercent = 10 });
        var result = (await response.Content.ReadFromJsonAsync<ExpenseReviewResult>())!;
        Assert.All(result.Items, item => Assert.Equal(.01m, item.WorkPortion));
        Assert.Equal(.02m, result.WorkPortionTotal);
    }

    [Fact]
    public async Task Uncertain_reimbursement_produces_partial_total_and_action()
    {
        using var response = await Review(Phone with { Reimbursement = "unsure" });
        var result = (await response.Content.ReadFromJsonAsync<ExpenseReviewResult>())!;
        Assert.Null(Assert.Single(result.Items).WorkPortion);
        Assert.Equal(1, result.UnresolvedCount);
        Assert.Equal(1, result.AttentionCount);
        Assert.Equal(0, result.WorkPortionTotal);
        Assert.Contains("reimbursement", Assert.Single(result.Items[0].Actions));
    }

    [Fact]
    public async Task Zero_work_use_is_excluded_even_when_reimbursement_is_unknown()
    {
        using var response = await Review(Phone with { WorkUsePercent = 0, Reimbursement = "unsure", Purpose = "", Evidence = "missing" });
        var result = (await response.Content.ReadFromJsonAsync<ExpenseReviewResult>())!;
        Assert.Equal("excluded", Assert.Single(result.Items).Status);
        Assert.Equal(0, result.WorkPortionTotal);
        Assert.Equal(0, result.AttentionCount);
        Assert.Equal(0, result.UnresolvedCount);
    }

    [Fact]
    public async Task Missing_notes_and_unlocated_evidence_remain_actionable()
    {
        using var response = await Review(Phone with { Purpose = "  ", WorkUseBasis = null, EvidenceReference = "" });
        var result = (await response.Content.ReadFromJsonAsync<ExpenseReviewResult>())!;
        Assert.Equal(3, Assert.Single(result.Items).Actions.Count);
        Assert.Equal(240, result.WorkPortionTotal);
        Assert.Equal(1, result.AttentionCount);
    }

    [Theory]
    [InlineData("{\"expenses\":null}")]
    [InlineData("{\"expenses\":[null]}")]
    [InlineData("{\"expenses\":[{}]}")]
    [InlineData("{}")] [InlineData("null")] [InlineData("{bad json")]
    public async Task Invalid_payloads_return_bad_request(string json)
    {
        using var response = await client.PostAsync(Endpoint, new StringContent(json, Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("0", "40")] [InlineData("-1", "40")] [InlineData("1.001", "40")]
    [InlineData("1000000.01", "40")] [InlineData("100", "-1")] [InlineData("100", "101")]
    [InlineData("100", "40.5")]
    public async Task Invalid_money_and_percentage_do_not_produce_a_total(string amount, string percent)
    {
        using var response = await Review(Phone with { Amount = decimal.Parse(amount, System.Globalization.CultureInfo.InvariantCulture), WorkUsePercent = decimal.Parse(percent, System.Globalization.CultureInfo.InvariantCulture) });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.DoesNotContain("workPortionTotal", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Rejects_unsupported_duplicate_excessive_categories_and_bad_statuses()
    {
        ExpenseInput[][] cases = [[Phone with { Category = "car" }], [Phone, Phone], [Phone, Phone, Phone, Phone],
            [Phone with { Evidence = "approved" }], [Phone with { Reimbursement = null }],
            [Phone with { Purpose = new string('x', 301) }], [Phone with { EvidenceReference = new string('x', 121) }]];
        foreach (var items in cases)
        {
            using var response = await Review(items);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }
    }

    [Fact]
    public async Task Accepts_boundaries_and_empty_list_without_retaining_previous_request()
    {
        using var first = await Review(Phone with { Amount = 1_000_000, WorkUsePercent = 100, Purpose = new string('x', 300) });
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        using var second = await Review();
        var result = (await second.Content.ReadFromJsonAsync<ExpenseReviewResult>())!;
        Assert.Empty(result.Items);
        Assert.Equal(0, result.EnteredTotal);
    }

    [Fact]
    public async Task Rejects_oversize_and_wrong_content_type()
    {
        using var large = await client.PostAsync(Endpoint, new StringContent(new string('x', ExpenseReview.MaximumBodySize + 1), Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, large.StatusCode);
        using var wrong = await client.PostAsync(Endpoint, new StringContent("{}"));
        Assert.Equal(HttpStatusCode.UnsupportedMediaType, wrong.StatusCode);
    }
}
