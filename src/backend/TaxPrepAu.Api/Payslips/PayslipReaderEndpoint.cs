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

/*
 * One row of a payslip's earnings table, as printed. Hours and Rate are empty
 * for a row that states neither — a bonus, an allowance, a leave payment — and
 * such a row is unchecked rather than wrong.
 */
public sealed record PayslipEarningsLine(string Label, string Hours, string Rate, string Amount);

public static class PayslipReaderEndpoint
{
    /// <summary>The browser refuses a payslip above this, so nothing larger is expected here.</summary>
    public const int MaximumBodySize = 64 * 1024;
    public const int MaximumTextLength = 20_000;
    public const int MinimumTextLength = 40;

    /// <summary>The twelve fields the app already holds, in its own order.</summary>
    /// <summary>An earnings table longer than this is a misreading, not a payslip.</summary>
    public const int MaximumLines = 30;

    /*
     * What the document is, asked before what it says.
     *
     * The guard this replaces was "all twelve fields came back empty", which
     * stops nonsense and nothing else. An ATO notice of assessment is not
     * nonsense: it carries a name, an ABN, dates and dollar amounts, which is
     * exactly what a payslip reader is hunting for — and its figures cover a
     * financial year, so reading one as a payslip counts a year as a fortnight.
     *
     * A closed list, so a kind this app has no sentence for cannot come back.
     */
    public static readonly string[] DocumentKinds =
        ["payslip", "taxReturn", "annualIncomeStatement", "bankStatement", "employmentContract", "invoice", "other"];

    /// <summary>A name longer than this is a misreading of some other field.</summary>
    public const int MaximumNameLength = 120;

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

        WHAT IS THIS DOCUMENT? Answer in `documentKind`, using exactly one of:
        payslip, taxReturn, annualIncomeStatement, bankStatement, employmentContract,
        invoice, other.

        - payslip: ONE pay period, showing what was earned and what was taken out.
        - taxReturn: an ATO notice of assessment, a tax return, or similar. Its figures
          cover a FINANCIAL YEAR rather than a pay period.
        - annualIncomeStatement: an income statement or payment summary covering a whole
          financial year for one employer.
        - bankStatement: a list of transactions on an account.
        - employmentContract: a contract, letter of offer or variation.
        - invoice: an invoice, a receipt or a bill.
        - other: anything else, including a document you cannot place.

        Answer this honestly and independently of what you were asked to find. "other"
        is a good answer. Do not answer "payslip" because payslip fields were requested:
        a document is what it is.

        When the kind is taxReturn, annualIncomeStatement, bankStatement,
        employmentContract or invoice, return "" for every field below and [] for lines.
        Those documents state figures for a whole year or for something that is not pay
        at all, and a figure taken from one of them is added to a pay history where it
        cannot be told apart from a fortnight's wages.

        When the kind is "other", still fill in whatever the document does state. A
        payslip in a layout you have never seen is an "other" you should still read; the
        person is shown your answer and decides.

        WHO IS IT MADE OUT TO? Put the employee's name in `paidTo`, exactly as printed,
        or "" when the document states none. It is used for one thing only: noticing
        that two documents name two different people. It is never stored, never shown
        beside any figure, and never written into any report.

        Overtime, penalty rates, allowances and leave loading are never any of the twelve
        fields above; they belong in `lines` below.

        THE EARNINGS TABLE goes in `lines`, one entry per row, in the order the payslip
        prints them. Most of a shift worker's pay is in the rows below the ordinary one,
        and leaving them out means reading a tenth of the payslip.

        - label: that row's description exactly as printed, such as "Saturday Hours".
        - hours, rate, amount: as printed, from the THIS PAY column only, with no currency
          symbol, no commas and no sign. Keep every decimal place the payslip prints.
          A rate of 49.8080 is not 49.81, and rounding it makes the row stop adding up.
        - "" for any of the three that row does not print. A bonus with an amount and no
          hours is normal.
        - Include only rows of EARNINGS. Never the table's own total row, and never a tax,
          deduction, superannuation or year-to-date row.
        - Never invent a row, never merge two rows, never split one. Copy what is there.
        - Return [] when the payslip prints no such table.

        YOUR TABLE IS CHECKED. Every figure in it is looked for in the text you were given,
        and the amounts must add up to the gross you returned. If either fails, the whole
        table is thrown away and the person types it in. Guessing a row cannot be hidden,
        and an omitted row is safer than an invented one.
        """;

    public static void MapPayslipReader(this WebApplication app)
    {
        app.MapPost("/api/payslip/read", async (HttpRequest request, HttpResponse response, IConfiguration configuration, PayslipReadLimiter limiter, OriginSecret origin) =>
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
            var decision = limiter.TryRead(PayslipReadLimiter.ClientKey(request, origin.Trusts(request)));
            if (!decision.Allowed)
            {
                response.Headers["Retry-After"] = ((int)Math.Ceiling(decision.RetryAfter.TotalSeconds)).ToString(CultureInfo.InvariantCulture);
                return Results.Json(new { available = false, message = PayslipReadLimiter.Message(decision) }, statusCode: 429);
            }

            try
            {
                var reading = await Read(text, key!, request.HttpContext.RequestAborted);
                var lines = VerifiedLines(reading.Lines, text);
                /*
                 * The kind and the name travel beside the figures rather than
                 * gating them here. The browser asks the person about a document
                 * that is not a payslip, and an override must not cost a second
                 * reading — so the figures come back either way and nothing is
                 * added to a pay history until somebody says so.
                 */
                return Results.Ok(new { available = true, fields = reading.Facts, lines, documentKind = reading.Kind, paidTo = reading.PaidTo });
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
        properties["documentKind"] = new { type = "string", @enum = DocumentKinds };
        properties["paidTo"] = new { type = "string" };
        properties["lines"] = new
        {
            type = "array",
            maxItems = MaximumLines,
            items = new
            {
                type = "object",
                properties = new
                {
                    label = new { type = "string" },
                    hours = new { type = "string" },
                    rate = new { type = "string" },
                    amount = new { type = "string" },
                },
                required = new[] { "label", "hours", "rate", "amount" },
                additionalProperties = false,
            },
        };
        return new Dictionary<string, JsonElement>
        {
            ["type"] = JsonSerializer.SerializeToElement("object"),
            ["properties"] = JsonSerializer.SerializeToElement(properties),
            ["required"] = JsonSerializer.SerializeToElement(Fields.Concat(["documentKind", "paidTo", "lines"]).ToArray()),
            ["additionalProperties"] = JsonSerializer.SerializeToElement(false),
        };
    }

    /*
     * The caller's cancellation is passed all the way to the model. A browser
     * that gave up — the reader times out after a minute — should not leave a
     * call running that is still being billed for an answer nobody will read.
     */
    private static async Task<(Dictionary<string, string> Facts, List<PayslipEarningsLine> Lines, string Kind, string PaidTo)> Read(string text, string apiKey, CancellationToken cancellationToken)
    {
        AnthropicClient client = new() { ApiKey = apiKey };
        var message = await client.Messages.Create(new MessageCreateParams
        {
            Model = "claude-opus-5",
            // Room for an earnings table as well as the twelve fields.
            MaxTokens = 4096,
            System = SystemPrompt,
            OutputConfig = new OutputConfig { Format = new JsonOutputFormat { Schema = Schema() } },
            Messages = [new() { Role = Role.User, Content = text }],
        }, cancellationToken);

        var json = string.Concat(message.Content.Select(b => b.Value).OfType<TextBlock>().Select(b => b.Text));
        return (Parse(json), ParseLines(json), ParseDocumentKind(json), ParsePaidTo(json));
    }

    /// <summary>What the model says this document is, or "other" for anything this app
    /// has no sentence for. Never blank: the browser has to answer for every file.</summary>
    public static string ParseDocumentKind(string json)
    {
        var kind = Property(json, "documentKind", 40);
        return DocumentKinds.Contains(kind, StringComparer.Ordinal) ? kind : "other";
    }

    /*
     * The name the document is made out to.
     *
     * Returned so the browser can notice that two documents name two different
     * people. It is not stored here, not logged, and not written anywhere: the
     * text it came from was already in this request and is discarded with it.
     * What the browser keeps is a digest, never this.
     */
    public static string ParsePaidTo(string json) => Property(json, "paidTo", MaximumNameLength);

    private static string Property(string json, string name, int longest)
    {
        if (string.IsNullOrWhiteSpace(json)) return string.Empty;
        JsonDocument document;
        try { document = JsonDocument.Parse(json); }
        catch (JsonException) { return string.Empty; }
        using (document)
        {
            if (document.RootElement.ValueKind != JsonValueKind.Object) return string.Empty;
            if (!document.RootElement.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.String) return string.Empty;
            var read = (value.GetString() ?? string.Empty).Trim();
            return read.Length > longest ? string.Empty : read;
        }
    }

    /*
     * The earnings table, narrowed to rows this app can do something with.
     *
     * A row needs a label and an amount to be a row at all. Hours and a rate
     * are optional, because a bonus or an allowance prints neither, and a row
     * without them is simply one the arithmetic cannot check rather than one
     * that is wrong.
     */
    public static List<PayslipEarningsLine> ParseLines(string json)
    {
        var lines = new List<PayslipEarningsLine>();
        if (string.IsNullOrWhiteSpace(json)) return lines;

        JsonDocument document;
        try { document = JsonDocument.Parse(json); }
        catch (JsonException) { return lines; }

        using (document)
        {
            if (document.RootElement.ValueKind != JsonValueKind.Object) return lines;
            if (!document.RootElement.TryGetProperty("lines", out var list) || list.ValueKind != JsonValueKind.Array) return lines;
            foreach (var entry in list.EnumerateArray())
            {
                if (lines.Count >= MaximumLines) break;
                if (entry.ValueKind != JsonValueKind.Object) continue;
                var label = Field(entry, "label", 80);
                var amount = Figure(Field(entry, "amount", 40));
                if (label.Length == 0 || amount.Length == 0) continue;
                lines.Add(new PayslipEarningsLine(label, Figure(Field(entry, "hours", 40)), Figure(Field(entry, "rate", 40)), amount));
            }
        }
        return lines;
    }

    private static string Field(JsonElement entry, string name, int longest)
    {
        if (!entry.TryGetProperty(name, out var value)) return string.Empty;
        var read = value.ValueKind switch
        {
            JsonValueKind.String => value.GetString() ?? string.Empty,
            JsonValueKind.Number => value.ToString(),
            _ => string.Empty,
        };
        read = read.Trim();
        return read.Length > longest ? string.Empty : read;
    }

    /// <summary>A plain figure as a payslip prints one, to four decimal places, or nothing.
    /// A symbol, a range or a word is exactly what an inferred number looks like.</summary>
    private static string Figure(string value)
        => System.Text.RegularExpressions.Regex.IsMatch(value, @"^\d{1,7}(?:\.\d{1,4})?$") ? value : string.Empty;

    /*
     * Every figure in the table has to be in the payslip.
     *
     * This is the transcription check, and it is the same defence the contract
     * reader uses on its quoted sentence. A table is a lot of numbers to invent
     * and a person will not check thirty of them by hand, so the document does
     * the checking: each figure is looked for in the text the model was given,
     * with symbols and separators removed from both sides so "$1,917.61" in the
     * page matches "1917.61" in the answer.
     *
     * All or nothing. A model that produced one figure the payslip does not
     * contain has not earned belief about the rest of the table, and half a
     * table is worse than none — the missing half would read as pay that was
     * never itemised.
     */
    public static List<PayslipEarningsLine> VerifiedLines(List<PayslipEarningsLine> lines, string text)
    {
        var flat = Digits(text);
        foreach (var line in lines)
            foreach (var figure in new[] { line.Hours, line.Rate, line.Amount })
                if (figure.Length > 0 && !flat.Contains(Digits(figure), StringComparison.Ordinal)) return [];
        return lines;
    }

    private static string Digits(string value) => value.Replace(",", string.Empty).Replace("$", string.Empty);

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
