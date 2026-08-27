// Create the ASP.NET Core application builder. Later, this is where we will
// register services such as transaction importers and database access.
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

// Start the web server and wait for incoming requests.
app.Run();

// Exposing Program as a partial class will let automated integration tests
// start this API in memory without changing the production entry point.
public partial class Program;
