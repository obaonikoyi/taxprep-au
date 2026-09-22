using System.Globalization;
using System.Text.Json;
using Anthropic;
using Anthropic.Exceptions;
using Anthropic.Models.Messages;

namespace TaxPrepAu.Api.Payslips;

/*
 * Reading a payslip layout nobody documented.
 *
 * Every other reader in this project is a parser over a layout we wrote down,
 * which is why it can be held to its arithmetic. That covers three layouts and
 * no real employer's. A person with their own payslips types about a dozen
 * figures per document, and they do not come back.
 *
 * This endpoint is the other route: the text the browser already extracted
 * goes to a model, which proposes the same twelve fields. It proposes. The
 * confirm step that every payslip already passes through is unchanged, and no
 * figure reaches a chart or a check until the person has looked at it.
 *
 * The document never comes here. The browser extracts the text with pdf.js and
 * sends that; the PDF stays on the device. Nothing is written to disk or logged
 * here, and the request is not stored.
 *
 * Turned off unless a key is configured. Without one the endpoint answers 503
 * and says so, and the app keeps offering manual entry — which is what every
 * deployment does until someone deliberately sets Anthropic:ApiKey.
 */
public sealed record PayslipReadRequest(string? Text);

public static class PayslipReaderEndpoint
{
    /// <summary>The browser refuses a payslip above this, so nothing larger is expected here.</summary>
    public const int MaximumBodySize = 64 * 1024;
    public const int MaximumTextLength = 20_000;
    public const int MinimumTextLength = 40;

    /// <summary>The twelve fields the app already holds, in its own order.</summary>
    public static readonly string[] Fields =
    [
        "employer", "periodStart", "periodEnd", "payDate", "gross", "withheld",
        "deductions", "net", "super", "hours", "rate", "ordinary"
    ];

    /*
     * The one thing that must not go wrong.
     *
     * A payslip usually prints two columns: this pay, and year to date. Taking a
     * year-to-date figure for a period figure does not look like an error — it
     * looks like a large pay — and it would then be summed with every other
     * period into a total that is wrong by a year. Every documented parser in
     * this project reads the period column only, and so must this.
     *
     * The rest of the prompt is about refusing: an empty string is a correct,
     * expected answer, and is always better than a plausible guess, because the
     * person is about to be asked to confirm what comes back.
     */
    public const string SystemPrompt = """
        You read Australian payslips. You are given the plain text extracted from one payslip
        and you return the figures it states.

        Return a JSON object with exactly these keys, all strings:
        employer, periodStart, periodEnd, payDate, gross, withheld, deductions, net, super,
        hours, rate, ordinary.

        Rules, in order of importance:

        1. NEVER return a year-to-date, cumulative, financial-year or "YTD" figure. Payslips
           commonly print a YTD column beside the amount for this pay period. Only the amount
           for THIS pay period is ever correct here. If you cannot tell which column is which,
           return an empty string for that field. A wrong figure here is summed with other
           payslips and produces a total that is wrong by a year.
        2. Never calculate, infer or estimate a figure that is not printed. If the payslip does
           not state it, return an empty string. Do not derive net from gross, or ordinary pay
           from hours times rate.
        3. Return an empty string for anything you are not sure about. An empty string is a
           normal answer and costs nothing: the person is asked to check every field, and a
           blank one simply asks them to fill it in. A confident wrong number does not.

        Field formats:
        - employer: the paying employer's name as printed, nothing else.
        - periodStart, periodEnd, payDate: YYYY-MM-DD.
        - gross, withheld, deductions, net, super, ordinary: a plain amount such as 1906.50,
          with no currency symbol, no sign and no thousands separators.
        - gross: gross pay for this period before deductions.
        - withheld: PAYG / income tax withheld this period.
        - deductions: other deductions this period, excluding tax. If the payslip shows none,
          return 0.00. If you cannot tell, return an empty string.
        - net: net or take-home pay for this period.
        - super: superannuation for this period, if stated.
        - hours: ordinary hours worked this period, such as 62.00. Not overtime hours.
        - rate: the ordinary hourly rate, such as 30.75. Not an overtime or penalty rate.
        - ordinary: the pay for those ordinary hours, if it is itemised separately from gross.

        Overtime, penalty rates, allowances and leave loading are never any of these fields.
        Leave them out; only the ordinary line is read.
        """;

    public static void MapPayslipReader(this WebApplication app)
    {
        app.MapPost("/api/payslip/read", async (HttpRequest request, HttpResponse response, IConfiguration configuration, PayslipReadLimiter limiter) =>
        {
            response.Headers.CacheControl = "no-store";
            if (!request.HasJsonContentType())
                return Results.Json(new { message = "Send the payslip text as JSON." }, statusCode: 415);

            var key = configuration["Anthropic:ApiKey"];
            if (string.IsNullOrWhiteSpace(key))
                return Results.Json(new
                {
                    available = false,
                    message = "The assisted reader is not configured on this deployment. Enter the figures from your payslip instead.",
                }, statusCode: 503);

            // Bound the body before reading it into memory, as the other endpoints do.
            using var buffer = new MemoryStream();
            var chunk = new byte[4096];
            int count;
            while ((count = await request.Body.ReadAsync(chunk, request.HttpContext.RequestAborted)) > 0)
            {
                if (buffer.Length + count > MaximumBodySize)
                    return Results.Json(new { message = "That payslip text is too large to read." }, statusCode: 413);
                buffer.Write(chunk, 0, count);
            }

            PayslipReadRequest? input;
            try
            {
                input = JsonSerializer.Deserialize<PayslipReadRequest>(buffer.ToArray(), new JsonSerializerOptions(JsonSerializerDefaults.Web));
            }
            catch (JsonException)
            {
                return Results.BadRequest(new { message = "Send the payslip text as JSON." });
            }

            var text = input?.Text?.Trim() ?? string.Empty;
            if (text.Length < MinimumTextLength || text.Length > MaximumTextLength)
                return Results.BadRequest(new { message = "Send the text of one payslip." });

            /*
             * Counted here, as close to the spend as the code gets: a request
             * that is never going to reach the model should not use up anyone's
             * allowance, or a caller could lock the reader out for the day with
             * malformed requests that cost nothing to refuse. Reading a bounded
             * body first is what every other endpoint here already does.
             *
             * See PayslipReadLimiter for what each of the two layers is worth.
             */
            var decision = limiter.TryRead(PayslipReadLimiter.ClientKey(request));
            if (!decision.Allowed)
            {
                response.Headers["Retry-After"] = ((int)Math.Ceiling(decision.RetryAfter.TotalSeconds)).ToString(CultureInfo.InvariantCulture);
                return Results.Json(new { available = false, message = PayslipReadLimiter.Message(decision) }, statusCode: 429);
            }

            try
            {
                var facts = await Read(text, key!, request.HttpContext.RequestAborted);
                return Results.Ok(new { available = true, fields = facts });
            }
            catch (OperationCanceledException)
            {
                // The person navigated away or cancelled. Nothing to report.
                return Results.Json(new { available = false, message = "Reading cancelled." }, statusCode: 499);
            }
            catch (AnthropicApiException)
            {
                return Results.Json(new
                {
                    available = false,
                    message = "The assisted reader could not read this payslip. Enter the figures from your payslip instead.",
                }, statusCode: 502);
            }
        }).WithName("ReadPayslip");
    }

    /// <summary>The schema is the app's own twelve fields, so the model cannot answer in a different shape.</summary>
    public static Dictionary<string, JsonElement> Schema()
    {
        var properties = new Dictionary<string, object>();
        foreach (var field in Fields) properties[field] = new { type = "string" };
        return new Dictionary<string, JsonElement>
        {
            ["type"] = JsonSerializer.SerializeToElement("object"),
            ["properties"] = JsonSerializer.SerializeToElement(properties),
            ["required"] = JsonSerializer.SerializeToElement(Fields),
            ["additionalProperties"] = JsonSerializer.SerializeToElement(false),
        };
    }

    /*
     * The caller's cancellation is passed all the way to the model. A browser
     * that gave up — the reader times out after a minute — should not leave a
     * call running that is still being billed for an answer nobody will read.
     */
    private static async Task<Dictionary<string, string>> Read(string text, string apiKey, CancellationToken cancellationToken)
    {
        AnthropicClient client = new() { ApiKey = apiKey };
        var message = await client.Messages.Create(new MessageCreateParams
        {
            Model = "claude-opus-5",
            MaxTokens = 2048,
            System = SystemPrompt,
            OutputConfig = new OutputConfig { Format = new JsonOutputFormat { Schema = Schema() } },
            Messages = [new() { Role = Role.User, Content = text }],
        }, cancellationToken);

        var json = string.Concat(message.Content.Select(b => b.Value).OfType<TextBlock>().Select(b => b.Text));
        return Parse(json);
    }

    /// <summary>
    /// Keep only the twelve known fields, as strings, and never let a null or a
    /// number through as one. The browser validates every value again before it
    /// is shown, and the person confirms it after that.
    /// </summary>
    public static Dictionary<string, string> Parse(string json)
    {
        var facts = new Dictionary<string, string>();
        foreach (var field in Fields) facts[field] = string.Empty;
        if (string.IsNullOrWhiteSpace(json)) return facts;

        JsonDocument document;
        try { document = JsonDocument.Parse(json); }
        catch (JsonException) { return facts; }

        using (document)
        {
            if (document.RootElement.ValueKind != JsonValueKind.Object) return facts;
            foreach (var field in Fields)
            {
                if (!document.RootElement.TryGetProperty(field, out var value)) continue;
                var read = value.ValueKind switch
                {
                    JsonValueKind.String => value.GetString() ?? string.Empty,
                    JsonValueKind.Number => value.ToString(),
                    _ => string.Empty,
                };
                facts[field] = read.Trim().Length > 120 ? string.Empty : read.Trim();
            }
        }
        return facts;
    }
}
