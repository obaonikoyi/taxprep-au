using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.StaticFiles;
using TaxPrepAu.Api.Transactions;
using TaxPrepAu.Api.Expenses;
using TaxPrepAu.Api.Payslips;

var builder = WebApplication.CreateBuilder(args);
builder.Services.Configure<FormOptions>(options =>
{
    // Keep these bounded prototype uploads in memory, including malformed requests.
    options.MemoryBufferThreshold = ImportPreviewEndpoint.MaximumRequestSize;
    options.MultipartBodyLengthLimit = ImportPreviewEndpoint.MaximumRequestSize;
    options.ValueLengthLimit = 1024;
    options.ValueCountLimit = 1;
});
/*
 * One limiter for the whole process, because a limit that forgets between
 * requests is not a limit. See PayslipReadLimiter for the numbers and what
 * they cost.
 *
 * Built from the resolved IConfiguration rather than from builder.Configuration,
 * which is the same configuration the endpoint reads its key from and not
 * necessarily the same object: a host that layers configuration on after this
 * line — a test host does exactly that — would otherwise hand the endpoint one
 * set of settings and the limiter another.
 */
builder.Services.AddSingleton(provider => PayslipReadLimiter.FromConfiguration(
    provider.GetRequiredService<IConfiguration>(),
    warn: message => provider.GetRequiredService<ILoggerFactory>().CreateLogger("Payslips.ReadLimits").LogWarning("{Message}", message)));
// Whether a request's forwarded headers may be believed. Unset by default.
builder.Services.AddSingleton(provider => OriginSecret.FromConfiguration(provider.GetRequiredService<IConfiguration>()));
var app = builder.Build();

// The deployment container is reached through Railway's HTTPS edge. Its private
// upstream is HTTP; redirecting there would break healthchecks or create a loop.
// Standalone hosts keep HTTPS redirection unless explicitly configured otherwise.
if (!app.Environment.IsDevelopment() && !builder.Configuration.GetValue<bool>("Hosting:HttpsHandledByProxy"))
    app.UseHttpsRedirection();

// The assembly, namespaces and directories are still named TaxPrepAu.Api after
// the September 2026 rename to Xoba Paycheck. No user sees an assembly name,
// and renaming one means moving directories and rewriting the solution, both
// .csproj files, every namespace and using, the Dockerfile paths and the build
// workflow — a clean separate change, not a side effect of a rebrand.
// See docs/RENAME_TO_XOBA_PAYCHECK.md.
// Xoba Paycheck reads payslips, bank statements and receipts in the browser and
// sends none of them anywhere. That promise cannot rest on every proxy in
// front of this app leaving the page alone: Cloudflare's analytics feature,
// for one, injects a third-party script into HTML responses that look like
// they came from a browser, which is invisible to curl and to any check that
// does not drive a real one. These headers make the browser enforce the
// promise, whoever is in front of us.
// Parameter types are spelled out: `Use` has two overloads here, and the
// RequestDelegate one is the cheaper per request.
app.Use(async (HttpContext context, RequestDelegate next) =>
{
    var headers = context.Response.Headers;
    headers["Content-Security-Policy"] = string.Join("; ",
        "default-src 'self'",
        // pdf.js compiles WebAssembly. Nothing here evaluates strings, so
        // 'unsafe-eval' stays out.
        "script-src 'self' 'wasm-unsafe-eval'",
        // The document engine runs in a worker, and pdf.js can fall back to a
        // blob worker when the module worker is unavailable.
        "worker-src 'self' blob:",
        // React writes style attributes for chart bars and progress fills.
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        // The line that carries the promise: no page may talk to a third party.
        "connect-src 'self' blob: data:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'");
    headers["X-Content-Type-Options"] = "nosniff";
    headers["Referrer-Policy"] = "no-referrer";
    await next(context);
});

app.UseDefaultFiles();
// The browser document engine is hosted here; documents never enter this API.
var assetTypes = new FileExtensionContentTypeProvider();
foreach (var extension in new[] { ".bcmap", ".pfb", ".icc", ".gz" })
    assetTypes.Mappings[extension] = "application/octet-stream";
assetTypes.Mappings[".wasm"] = "application/wasm";
assetTypes.Mappings[".mjs"] = "text/javascript";
app.UseStaticFiles(new StaticFileOptions { ContentTypeProvider = assetTypes });

app.MapGet("/api/health", () => Results.Ok(new
{
    status = "healthy",
    service = "Xoba Paycheck API"
})).WithName("GetHealth");
app.MapImportPreview();
app.MapExpenseReview();
app.MapPayslipReader();
app.MapPayslipReadUsage();
app.Run();

public partial class Program;
