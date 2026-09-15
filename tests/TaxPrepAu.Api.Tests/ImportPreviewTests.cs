using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using Microsoft.AspNetCore.Mvc.Testing;
using TaxPrepAu.Api.Transactions;
using Xunit;

namespace TaxPrepAu.Api.Tests;

public class ImportPreviewTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient client;
    private const string Endpoint = "/api/transactions/import-preview";
    private const string Header = "date,description,amount\n";

    public ImportPreviewTests(WebApplicationFactory<Program> factory)
    {
        client = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });
    }

    private async Task<HttpResponseMessage> Upload(string text, string filename = "example.csv") =>
        await UploadBytes(Encoding.UTF8.GetBytes(text), filename);

    private async Task<HttpResponseMessage> UploadBytes(byte[] bytes, string filename = "example.csv")
    {
        using var body = new MultipartFormDataContent();
        body.Add(new ByteArrayContent(bytes), "file", filename);
        return await client.PostAsync(Endpoint, body);
    }

    [Fact]
    public async Task Sample_returns_twenty_rows_and_exact_total()
    {
        using var response = await Upload(await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "transactions.csv")));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(response.Headers.CacheControl?.NoStore);
        var preview = await response.Content.ReadFromJsonAsync<TransactionImportPreview>();
        Assert.NotNull(preview);
        Assert.Empty(preview.Errors);
        Assert.Equal(20, preview.Transactions.Count);
        Assert.Contains(preview.Transactions, x => x.Description == "City Stationery, Adelaide");
        Assert.Equal(1374.12m, preview.NetTotal);
    }

    [Fact]
    public async Task Preserves_valid_rows_with_physical_line_numbers_and_decimal_total()
    {
        using var response = await Upload(Header + "\n2026-02-30,Bad,-2\n2026-02-28,Good,0.10\n2026-03-01,Good,0.20");
        var preview = await response.Content.ReadFromJsonAsync<TransactionImportPreview>();
        Assert.NotNull(preview);
        Assert.Equal(2, preview.Transactions.Count);
        Assert.Equal(3, Assert.Single(preview.Errors).RowNumber);
        Assert.Equal(0.30m, preview.NetTotal);
    }

    [Theory]
    [InlineData("date,description,amount,AMOUNT\n2026-01-01,Test,1,2", "unique")]
    [InlineData("date,description\n2026-01-01,Test", "Missing required")]
    [InlineData("\"date\"oops,description,amount", "quotation")]
    [InlineData("date,description,amount\n", "no transaction")]
    [InlineData("  \n", "empty")]
    public async Task File_level_problems_return_structured_errors(string csv, string expected)
    {
        using var response = await Upload(csv);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var preview = await response.Content.ReadFromJsonAsync<TransactionImportPreview>();
        Assert.NotNull(preview);
        Assert.Empty(preview.Transactions);
        Assert.Contains(expected, Assert.Single(preview.Errors).Message);
    }

    [Theory]
    [InlineData("2026-01-01,\"bad\"oops,1")]
    [InlineData("2026-01-01,,1")]
    [InlineData("2026-01-01,Test,1,extra")]
    [InlineData("2026-1-01,Test,1")]
    [InlineData("2026-01-01,Test,NaN")]
    [InlineData("2026-01-01,Test,1.234")]
    [InlineData("2026-01-01,Test,1e3")]
    [InlineData("2026-01-01,Test,99999999999999999999999999999999999")]
    [InlineData("2026-01-01,Test,\"1,23\"")]
    public async Task Bad_row_does_not_crash_or_discard_later_valid_rows(string badRow)
    {
        using var response = await Upload(Header + badRow + "\n2026-01-02,Good,-3.50");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var preview = await response.Content.ReadFromJsonAsync<TransactionImportPreview>();
        Assert.NotNull(preview);
        Assert.Single(preview.Errors);
        Assert.Equal("Good", Assert.Single(preview.Transactions).Description);
        Assert.Equal(-3.50m, preview.NetTotal);
    }

    [Fact]
    public async Task Accepts_bom_reordered_headers_CRLF_multiline_and_escaped_quotes()
    {
        using var response = await Upload("\uFEFFAMOUNT,Description,date\r\n+12.25,\"Line one\r\nLine \"\"two\"\"\",2024-02-29", "EXAMPLE.CSV");
        var preview = await response.Content.ReadFromJsonAsync<TransactionImportPreview>();
        Assert.NotNull(preview);
        Assert.Empty(preview.Errors);
        var row = Assert.Single(preview.Transactions);
        Assert.Equal(12.25m, row.Amount);
        Assert.Contains("Line \"two\"", row.Description);
    }

    [Theory]
    [InlineData("", "test.csv")]
    [InlineData("anything", "test.txt")]
    public async Task Rejects_invalid_file(string csv, string filename)
    {
        using var response = await Upload(csv, filename);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Rejects_invalid_utf8()
    {
        using var response = await UploadBytes([0xFF, 0xFE, 0xFF]);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("UTF-8", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task File_size_boundary_is_inclusive_and_excess_is_rejected()
    {
        var prefix = Header + "2026-01-01,Test,1\n";
        using var exact = await Upload(prefix.PadRight(ImportPreviewEndpoint.MaximumFileSize, '\n'));
        Assert.Equal(HttpStatusCode.OK, exact.StatusCode);
        using var over = await Upload(prefix.PadRight(ImportPreviewEndpoint.MaximumFileSize + 1, '\n'));
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, over.StatusCode);
    }

    [Fact]
    public async Task Excessive_rows_reject_entire_file_instead_of_returning_incomplete_totals()
    {
        using var response = await Upload(Header + string.Concat(Enumerable.Repeat("2026-01-01,Test,1\n", 5001)));
        var preview = await response.Content.ReadFromJsonAsync<TransactionImportPreview>();
        Assert.NotNull(preview);
        Assert.Empty(preview.Transactions);
        Assert.Contains("5000", Assert.Single(preview.Errors).Message);
        Assert.Equal(0, preview.NetTotal);
    }

    [Fact]
    public async Task Rejects_multiple_files_and_wrong_field_name()
    {
        using var multiple = new MultipartFormDataContent();
        multiple.Add(new StringContent(Header), "file", "one.csv");
        multiple.Add(new StringContent(Header), "file", "two.csv");
        using var first = await client.PostAsync(Endpoint, multiple);
        Assert.Equal(HttpStatusCode.BadRequest, first.StatusCode);
        using var wrong = new MultipartFormDataContent();
        wrong.Add(new StringContent(Header), "other", "one.csv");
        using var second = await client.PostAsync(Endpoint, wrong);
        Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
    }

    [Fact]
    public async Task Rejects_missing_file_and_invalid_multipart_without_internal_error()
    {
        using var plain = await client.PostAsync(Endpoint, new StringContent("not multipart"));
        Assert.Equal(HttpStatusCode.BadRequest, plain.StatusCode);
        using var broken = new StringContent("broken body");
        broken.Headers.ContentType = new MediaTypeHeaderValue("multipart/form-data");
        using var response = await client.PostAsync(Endpoint, broken);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Health_still_works()
    {
        using var response = await client.GetAsync("/api/health");
        response.EnsureSuccessStatusCode();
        Assert.Contains("healthy", await response.Content.ReadAsStringAsync());
    }
}
