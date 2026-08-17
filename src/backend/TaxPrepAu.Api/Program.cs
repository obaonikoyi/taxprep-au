var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.UseHttpsRedirection();

app.MapGet("/api/health", () => Results.Ok(new
{
    status = "healthy",
    service = "TaxPrep AU API"
}))
.WithName("GetHealth");

app.Run();

public partial class Program;
