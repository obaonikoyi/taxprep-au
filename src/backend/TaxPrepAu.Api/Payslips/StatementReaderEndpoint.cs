using System.Globalization;
using System.Text.Json;
using Anthropic;
using Anthropic.Exceptions;
using Anthropic.Models.Messages;

namespace TaxPrepAu.Api.Payslips;

/*
 * Reading a bank statement whose layout nobody documented.
 *
 * This is the most sensitive document the app touches, and it is not close. A
 * payslip says who employs you and what you earn. A statement says where you
 * shop, what you subscribe to, who you pay and when — a year of it, line by
 * line. The statements screen has said in plain words that no model is used,
 * and that stays true for everybody who does not deliberately turn this on.
 *
 * What makes it defensible is something the payslip reader does not have: a
 * statement carries its own checksum. It prints an opening balance, a closing
 * balance and the debit and credit totals, and the transactions between them
 * must add up to exactly that. So a reading here is not a proposal for someone
 * to eyeball — nobody is going to hand-check two hundred rows — it is
 * arithmetic, and it is either right or it is refused.
 *
 *   opening + every amount == closing
 *   the debits add to the printed debits, the credits to the printed credits
 *   every running balance the reading states matches the row before it
 *
 * Any of those failing throws the whole reading away. A dropped transaction, a
 * transposed amount, an invented row: all of them break the sum, and none of
 * them can be smuggled past it.
 */
public sealed record StatementReadRequest(string? Text);

public static class StatementReaderEndpoint
{
    public const int MaximumBodySize = 1024 * 1024;
    public const int MaximumTextLength = 200_000;
    public const int MinimumTextLength = 200;
    public const int MaximumRows = 400;

    /*
     * A statement is the most expensive thing this app reads: pages of text in
     * and hundreds of rows out. Charged at roughly what it costs so the budget
     * keeps meaning what it says.
     */
    public const int BudgetCost = 10;

    public const string SystemPrompt = """
        You transcribe Australian bank statements. You are a transcriber, not an analyst:
        you copy what is printed and you never work anything out.

        Return a JSON object with exactly these keys:
        opening, closing, printedDebits, printedCredits, from, to (all strings), rows (an array),
        and why (a string).

        Each entry in rows is an object with exactly: date, description, amount, balance — all strings.
        - date: the POSTING date of the transaction, YYYY-MM-DD. Not the value date.
        - description: the transaction text as printed, on one line. Do not tidy, expand,
          translate, categorise or summarise it.
        - amount: the amount, negative for money out and positive for money in, such as
          -42.50 or 1906.50. No currency symbol, no commas, no brackets. A debit shown in a
          debit column, or in brackets, or with DR, is negative.
        - balance: the running balance printed on that row, such as 1234.56, or "" if the
          statement does not print one on that row.

        opening, closing, printedDebits and printedCredits are the figures the statement
        itself prints in its summary, as plain amounts. printedDebits and printedCredits are
        positive totals. from and to are the statement period, YYYY-MM-DD.

        NEVER DO ANY OF THIS:
        - Never calculate a balance, a total, or an amount that is not printed. If a figure
          is not on the statement, return "" for it.
        - Never invent, merge, split or reorder a transaction. One printed line of the
          transaction table is one entry, in the order printed.
        - Never leave a transaction out because it looks uninteresting, informational or
          repeated. Every posted transaction is copied.
        - Never include anything that is not a posted transaction: interest notices that say
          no amount was charged, headings, page footers, carried-forward markers, advertising.
        - Never correct an amount that looks wrong. Copy what is printed.

        Your transcription is checked against the statement's own arithmetic: the opening
        balance plus every amount must equal the closing balance, and the amounts must add
        to the printed totals. If it does not add up, the whole transcription is discarded
        and the person is told the statement could not be read. A missing or invented
        transaction cannot be hidden from that check, so do not guess — set why to what
        stopped you and return an empty rows array instead.
        """;

    public static void MapStatementReader(this WebApplication app)
    {
        app.MapPost("/api/statement/read", async (HttpRequest request, HttpResponse response, IConfiguration configuration, PayslipReadLimiter limiter, OriginSecret origin) =>
        {
            response.Headers.CacheControl = "no-store";
            if (!request.HasJsonContentType())
                return Results.Json(new { message = "Send the statement text as JSON." }, statusCode: 415);

            var key = configuration["Anthropic:ApiKey"];
            if (string.IsNullOrWhiteSpace(key))
                return Results.Json(new
                {
                    available = false,
                    message = "Reading an unsupported statement layout is not configured on this deployment. Use a CSV export from your bank instead.",
                }, statusCode: 503);

            using var buffer = new MemoryStream();
            var chunk = new byte[8192];
            int count;
            while ((count = await request.Body.ReadAsync(chunk, request.HttpContext.RequestAborted)) > 0)
            {
                if (buffer.Length + count > MaximumBodySize)
                    return Results.Json(new { message = "That statement is too long to read. Use a shorter period, or a CSV export." }, statusCode: 413);
                buffer.Write(chunk, 0, count);
            }

            StatementReadRequest? input;
            try
            {
                input = JsonSerializer.Deserialize<StatementReadRequest>(buffer.ToArray(), new JsonSerializerOptions(JsonSerializerDefaults.Web));
            }
            catch (JsonException)
            {
                return Results.BadRequest(new { message = "Send the statement text as JSON." });
            }

            var text = input?.Text?.Trim() ?? string.Empty;
            if (text.Length < MinimumTextLength || text.Length > MaximumTextLength)
                return Results.BadRequest(new { message = "Send the text of one statement." });

            var decision = limiter.TryRead(PayslipReadLimiter.ClientKey(request, origin.Trusts(request)), BudgetCost);
            if (!decision.Allowed)
            {
                response.Headers["Retry-After"] = ((int)Math.Ceiling(decision.RetryAfter.TotalSeconds)).ToString(CultureInfo.InvariantCulture);
                return Results.Json(new { available = false, message = PayslipReadLimiter.Message(decision) }, statusCode: 429);
            }

            try
            {
                var reading = await Read(text, key!, request.HttpContext.RequestAborted);
                return Results.Ok(new { available = true, statement = reading });
            }
            catch (OperationCanceledException)
            {
                return Results.Json(new { available = false, message = "Reading cancelled." }, statusCode: 499);
            }
            catch (AnthropicApiException)
            {
                return Results.Json(new
                {
                    available = false,
                    message = "The statement could not be read. Use a CSV export from your bank instead.",
                }, statusCode: 502);
            }
        }).WithName("ReadStatement");
    }

    public static Dictionary<string, JsonElement> Schema()
    {
        var row = new
        {
            type = "object",
            properties = new
            {
                date = new { type = "string" },
                description = new { type = "string" },
                amount = new { type = "string" },
                balance = new { type = "string" },
            },
            required = new[] { "date", "description", "amount", "balance" },
            additionalProperties = false,
        };
        var properties = new Dictionary<string, object>
        {
            ["opening"] = new { type = "string" },
            ["closing"] = new { type = "string" },
            ["printedDebits"] = new { type = "string" },
            ["printedCredits"] = new { type = "string" },
            ["from"] = new { type = "string" },
            ["to"] = new { type = "string" },
            ["why"] = new { type = "string" },
            ["rows"] = new { type = "array", items = row },
        };
        return new Dictionary<string, JsonElement>
        {
            ["type"] = JsonSerializer.SerializeToElement("object"),
            ["properties"] = JsonSerializer.SerializeToElement(properties),
            ["required"] = JsonSerializer.SerializeToElement(new[] { "opening", "closing", "printedDebits", "printedCredits", "from", "to", "rows", "why" }),
            ["additionalProperties"] = JsonSerializer.SerializeToElement(false),
        };
    }

    private static async Task<object> Read(string text, string apiKey, CancellationToken cancellationToken)
    {
        AnthropicClient client = new() { ApiKey = apiKey };
        var message = await client.Messages.Create(new MessageCreateParams
        {
            Model = "claude-opus-5",
            // Hundreds of rows, not twelve fields.
            MaxTokens = 16000,
            System = SystemPrompt,
            OutputConfig = new OutputConfig { Format = new JsonOutputFormat { Schema = Schema() } },
            Messages = [new() { Role = Role.User, Content = text }],
        }, cancellationToken);

        var json = string.Concat(message.Content.Select(b => b.Value).OfType<TextBlock>().Select(b => b.Text));
        return Parse(json);
    }

    /// <summary>
    /// Narrow the answer to the shape the browser expects. The arithmetic that
    /// decides whether any of it is believed happens there, where the rest of
    /// the statement checks already live.
    /// </summary>
    public static object Parse(string json)
    {
        var empty = new
        {
            opening = "", closing = "", printedDebits = "", printedCredits = "", from = "", to = "",
            why = "The statement could not be read.",
            rows = Array.Empty<Dictionary<string, string>>(),
        };
        if (string.IsNullOrWhiteSpace(json)) return empty;

        JsonDocument document;
        try { document = JsonDocument.Parse(json); }
        catch (JsonException) { return empty; }

        using (document)
        {
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return empty;

            var rows = new List<Dictionary<string, string>>();
            if (root.TryGetProperty("rows", out var listed) && listed.ValueKind == JsonValueKind.Array)
            {
                foreach (var entry in listed.EnumerateArray())
                {
                    if (rows.Count >= MaximumRows) break;
                    if (entry.ValueKind != JsonValueKind.Object) continue;
                    rows.Add(new Dictionary<string, string>
                    {
                        ["date"] = Text(entry, "date", 40),
                        // A description is the one field here that is free text,
                        // and it is the one carrying where somebody shops.
                        ["description"] = Text(entry, "description", 1000),
                        ["amount"] = Text(entry, "amount", 40),
                        ["balance"] = Text(entry, "balance", 40),
                    });
                }
            }

            return new
            {
                opening = Text(root, "opening", 40),
                closing = Text(root, "closing", 40),
                printedDebits = Text(root, "printedDebits", 40),
                printedCredits = Text(root, "printedCredits", 40),
                from = Text(root, "from", 40),
                to = Text(root, "to", 40),
                why = Text(root, "why", 300),
                rows = rows.ToArray(),
            };
        }
    }

    private static string Text(JsonElement element, string name, int longest)
    {
        if (!element.TryGetProperty(name, out var value)) return string.Empty;
        var read = value.ValueKind switch
        {
            JsonValueKind.String => value.GetString() ?? string.Empty,
            JsonValueKind.Number => value.ToString(),
            _ => string.Empty,
        };
        read = read.Trim();
        return read.Length > longest ? string.Empty : read;
    }
}
