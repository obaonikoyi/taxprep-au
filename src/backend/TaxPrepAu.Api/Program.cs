using Microsoft.AspNetCore.Http.Features;
using TaxPrepAu.Api.Transactions;

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

// Local Vite forwards to the HTTP development profile; production requires HTTPS.
if (!app.Environment.IsDevelopment()) app.UseHttpsRedirection();

app.MapGet("/api/health", () => Results.Ok(new
{
    status = "healthy",
    service = "TaxPrep AU API"
})).WithName("GetHealth");
app.MapImportPreview();
app.Run();

public partial class Program;
