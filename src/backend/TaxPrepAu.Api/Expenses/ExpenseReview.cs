using System.Text.Json;

namespace TaxPrepAu.Api.Expenses;

public sealed record ExpenseInput(string? Category, decimal? Amount, decimal? WorkUsePercent,
    string? Purpose, string? WorkUseBasis, string? Reimbursement, string? Evidence, string? EvidenceReference);
public sealed record ExpenseReviewRequest(List<ExpenseInput?>? Expenses);
public sealed record ReviewedExpense(string Category, decimal Amount, decimal WorkUsePercent,
    decimal? WorkPortion, string Status, IReadOnlyList<string> Actions);
public sealed record ExpenseReviewResult(IReadOnlyList<ReviewedExpense> Items, decimal EnteredTotal,
    decimal WorkPortionTotal, int UnresolvedCount, int AttentionCount);

public static class ExpenseReview
{
    public static readonly string[] Categories = ["travel", "phone", "protective-clothing"];
    public const int MaximumBodySize = 16_384;

    public static void MapExpenseReview(this WebApplication app)
    {
        app.MapPost("/api/expenses/review", async (HttpRequest request, HttpResponse response) =>
        {
            response.Headers.CacheControl = "no-store";
            if (!request.HasJsonContentType())
                return Results.Json(new { message = "Send expense details as JSON." }, statusCode: 415);

            // Bound the body before deserializing, including requests without Content-Length.
            using var buffer = new MemoryStream();
            var chunk = new byte[4096];
            int count;
            while ((count = await request.Body.ReadAsync(chunk, request.HttpContext.RequestAborted)) > 0)
            {
                if (buffer.Length + count > MaximumBodySize)
                    return Results.Json(new { message = "The expense request is too large." }, statusCode: 413);
                buffer.Write(chunk, 0, count);
            }

            ExpenseReviewRequest? input;
            try
            {
                input = JsonSerializer.Deserialize<ExpenseReviewRequest>(buffer.ToArray(),
                    new JsonSerializerOptions(JsonSerializerDefaults.Web) { NumberHandling = System.Text.Json.Serialization.JsonNumberHandling.Strict });
            }
            catch (JsonException)
            {
                return Results.BadRequest(new { message = "Send valid expense details with numeric amounts." });
            }

            var errors = Validate(input);
            if (errors.Count > 0) return Results.BadRequest(new { message = "Check the expense details.", errors });
            return Results.Ok(Calculate(input!.Expenses!.Select(x => x!).ToList()));
        }).WithName("ReviewExpenses");
    }

    public static List<string> Validate(ExpenseReviewRequest? request)
    {
        var errors = new List<string>();
        if (request?.Expenses is null || request.Expenses.Count > 3)
            return ["Send an expenses list with at most one item in each of the three categories."];
        var seen = new HashSet<string>();
        foreach (var item in request.Expenses)
        {
            if (item is null) { errors.Add("Each expense must contain details."); continue; }
            if (item.Category is null || !Categories.Contains(item.Category) || !seen.Add(item.Category))
                errors.Add("Choose a supported category only once.");
            if (item.Amount is null or <= 0 or > 1_000_000 || decimal.Round(item.Amount.Value, 2) != item.Amount)
                errors.Add("Amount must be between $0.01 and $1,000,000 with at most two decimal places.");
            if (item.WorkUsePercent is null or < 0 or > 100 || decimal.Truncate(item.WorkUsePercent.Value) != item.WorkUsePercent)
                errors.Add("Work use must be a whole percentage from 0 to 100.");
            if (item.Reimbursement is not ("none" or "full" or "unsure")) errors.Add("Choose a reimbursement status.");
            if (item.Evidence is not ("available" or "missing" or "unsure")) errors.Add("Choose an evidence status.");
            if (item.Purpose?.Length > 300 || item.WorkUseBasis?.Length > 300 || item.EvidenceReference?.Length > 120)
                errors.Add("Keep notes within the displayed character limits.");
        }
        return errors;
    }

    // This is arithmetic and a completeness checklist, never a tax eligibility decision.
    public static ExpenseReviewResult Calculate(IReadOnlyList<ExpenseInput> expenses)
    {
        var items = expenses.Select(item =>
        {
            var actions = new List<string>();
            var excluded = item.Reimbursement == "full" || item.WorkUsePercent == 0;
            decimal? portion = excluded ? 0 : item.Reimbursement == "unsure" ? null
                : decimal.Round(item.Amount!.Value * item.WorkUsePercent!.Value / 100, 2, MidpointRounding.AwayFromZero);
            if (excluded)
                actions.Add(item.Reimbursement == "full" ? "Fully reimbursed: excluded from the work-portion total."
                    : "No work use recorded: excluded from the work-portion total.");
            else
            {
                if (item.Reimbursement == "unsure") actions.Add("Clarify the reimbursement amount before including a work portion.");
                if (string.IsNullOrWhiteSpace(item.Purpose)) actions.Add("Describe how this expense relates to Sarah's work.");
                if (string.IsNullOrWhiteSpace(item.WorkUseBasis)) actions.Add("Record how the work-use percentage was worked out.");
                if (item.Evidence != "available") actions.Add("Find or check the supporting evidence.");
                else if (string.IsNullOrWhiteSpace(item.EvidenceReference)) actions.Add("Add a short reference so the evidence can be found.");
            }
            var status = excluded ? "excluded" : actions.Count > 0 ? "needs-attention" : "details-recorded";
            return new ReviewedExpense(item.Category!, item.Amount!.Value, item.WorkUsePercent!.Value, portion, status, actions);
        }).ToList();
        return new(items, items.Sum(x => x.Amount), items.Sum(x => x.WorkPortion ?? 0),
            items.Count(x => x.WorkPortion is null), items.Count(x => x.Status == "needs-attention"));
    }
}
