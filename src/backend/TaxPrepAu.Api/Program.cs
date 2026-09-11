// Create the ASP.NET Core application builder. Later, this is where we will
// register services such as transaction importers and database access.
using TaxPrepAu.Api.Transactions;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

// Redirect ordinary HTTP requests to the encrypted HTTPS version in supported
// environments. This matters because future requests may contain private data.
app.UseHttpsRedirection();

// A health endpoint is a small, safe check that answers: "Is the API running?"
// It deliberately returns no configuration, user details or financial data.
app.MapGet("/api/health", () => Results.Ok(new
{
    status = "healthy",
    service = "TaxPrep AU API"
}))
.WithName("GetHealth");

app.MapPost("/api/transactions/import-preview", async (IFormFile file) =>
{
    const long maximumFileSize = 1_000_000;

    if (!file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
        return Results.BadRequest(new { message = "Choose a CSV file." });

    if (file.Length == 0)
        return Results.BadRequest(new { message = "The CSV file is empty." });

    if (file.Length > maximumFileSize)
        return Results.BadRequest(new { message = "The CSV file must be smaller than 1 MB." });

    await using var stream = file.OpenReadStream();
    using var reader = new StreamReader(stream);
    var preview = CsvTransactionParser.Parse(reader);

    return Results.Ok(preview);
})
.DisableAntiforgery()
.WithName("PreviewTransactionImport");

// Start the web server and wait for incoming requests.
app.Run();

// Exposing Program as a partial class will let automated integration tests
// start this API in memory without changing the production entry point.
public partial class Program;
