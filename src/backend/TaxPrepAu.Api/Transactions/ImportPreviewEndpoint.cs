using System.Text;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;

namespace TaxPrepAu.Api.Transactions;

public static class ImportPreviewEndpoint
{
    public const int MaximumFileSize = 1_000_000;
    // Leave room for multipart headers while bounding the entire request.
    public const int MaximumRequestSize = 1_100_000;

    public static void MapImportPreview(this WebApplication app)
    {
        app.MapPost("/api/transactions/import-preview", Handle)
            .WithMetadata(new RequestSizeLimitAttribute(MaximumRequestSize))
            // Stateless preview has no cookie-authenticated action or stored state.
            // Revisit CSRF protection if authentication/persistence is introduced.
            .DisableAntiforgery()
            .WithName("PreviewTransactionImport");
    }

    private static async Task<IResult> Handle(HttpRequest request, CancellationToken cancellationToken)
    {
        request.HttpContext.Response.Headers.CacheControl = "no-store";
        if (request.ContentLength > MaximumRequestSize)
            return TooLarge();
        var limit = request.HttpContext.Features.Get<IHttpMaxRequestBodySizeFeature>();
        if (limit is { IsReadOnly: false }) limit.MaxRequestBodySize = MaximumRequestSize;
        if (!request.HasFormContentType || request.ContentType?.StartsWith("multipart/form-data", StringComparison.OrdinalIgnoreCase) != true)
            return Results.BadRequest(new { message = "Upload one CSV file using the file form field." });

        try
        {
            var form = await request.ReadFormAsync(cancellationToken);
            if (form.Files.Count != 1 || form.Files[0].Name != "file" || form.Count != 0)
                return Results.BadRequest(new { message = "Upload exactly one CSV file using the file form field." });
            var file = form.Files[0];
            if (!file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
                return Results.BadRequest(new { message = "Choose a CSV file." });
            if (file.Length == 0)
                return Results.BadRequest(new { message = "The CSV file is empty." });
            if (file.Length > MaximumFileSize) return TooLarge();

            await using var stream = file.OpenReadStream();
            // Strict UTF-8; BOM is removed in the header parser. Never write the upload to disk.
            using var reader = new StreamReader(stream, new UTF8Encoding(false, true), detectEncodingFromByteOrderMarks: false);
            return Results.Ok(CsvTransactionParser.Parse(reader));
        }
        catch (DecoderFallbackException)
        {
            return Results.BadRequest(new { message = "Save the CSV with UTF-8 encoding and try again." });
        }
        catch (BadHttpRequestException exception) when (exception.StatusCode == StatusCodes.Status413PayloadTooLarge)
        {
            return TooLarge();
        }
        catch (InvalidDataException)
        {
            return Results.BadRequest(new { message = "The upload is malformed or exceeds the upload limit. Choose one CSV up to 1 MB." });
        }
        catch (BadHttpRequestException)
        {
            return Results.BadRequest(new { message = "The upload could not be read. Choose the CSV again." });
        }
    }

    private static IResult TooLarge() => Results.Json(
        new { message = "Choose a CSV up to 1 MB (1,000,000 bytes)." }, statusCode: StatusCodes.Status413PayloadTooLarge);
}
