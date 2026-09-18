using Microsoft.AspNetCore.Http.Features;
using TaxPrepAu.Api.Transactions;
using TaxPrepAu.Api.Expenses;

var builder = WebApplication.CreateBuilder(args);
builder.Services.Configure<FormOptions>(options =>
{
    // Keep these bounded prototype uploads in memory, including malformed requests.
    options.MemoryBufferThreshold = ImportPreviewEndpoint.MaximumRequestSize;
    options.MultipartBodyLengthLimit = ImportPreviewEndpoint.MaximumRequestSize;
    options.ValueLengthLimit = 1024;
    options.ValueCountLimit = 1;
});
var app = builder.Build();

// The deployment container is reached through Railway's HTTPS edge. Its private
// upstream is HTTP; redirecting there would break healthchecks or create a loop.
// Standalone hosts keep HTTPS redirection unless explicitly configured otherwise.
if (!app.Environment.IsDevelopment() && !builder.Configuration.GetValue<bool>("Hosting:HttpsHandledByProxy"))
    app.UseHttpsRedirection();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/api/health", () => Results.Ok(new
{
    status = "healthy",
    service = "TaxPrep AU API"
})).WithName("GetHealth");
app.MapImportPreview();
app.MapExpenseReview();
app.Run();

public partial class Program;
