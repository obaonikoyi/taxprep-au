using System.Globalization;
using System.Text.Json;
using Anthropic;
using Anthropic.Exceptions;
using Anthropic.Models.Messages;

namespace TaxPrepAu.Api.Payslips;

/*
 * Reading the agreed rate out of a contract.
 *
 * Milestone 19 refused to do this and said why: a contract carries a salary, a
 * signature and third parties, and it is a different decision from a payslip's
 * figures. Those reasons have not gone away, so this is built around them
 * rather than past them.
 *
 * Why a contract is not a payslip:
 *
 *   A wrong figure here is worse than a wrong figure there. A payslip's gross
 *   pay is one row in a total the person checks. A contract's rate becomes the
 *   baseline every payslip is compared against, so one wrong number produces a
 *   run of confident, specific, wrong findings — and this app exists to turn
 *   those into a message someone sends their employer. Being wrong here costs
 *   the person their credibility with their own employer.
 *
 *   A contract rate is often conditional. "$25.00 per hour plus a 25% casual
 *   loading", "the rate for your classification under the award", "reviewed
 *   annually". A single number pulled out of that is not the agreed rate, and
 *   would disagree with every payslip. So the answer here is allowed to be
 *   "I am not going to say", and the prompt spends most of its length on when
 *   to say it.
 *
 *   A contract names other people. Only the text goes, as with a payslip, and
 *   nothing is stored: no file, no log of the text, no record of the request.
 *   What the app keeps afterwards is what it always kept — a rate and the
 *   person's own note — never the document.
 *
 * The one new defence: the model must quote the sentence it read the rate from,
 * and that quote is checked against the document before the answer is believed.
 * A rate with no quote, or a quote that is not in the contract, is thrown away
 * whatever it says. See Verified below.
 */
public sealed record ContractReadRequest(string? Text);

public static class ContractReaderEndpoint
{
    public const int MaximumBodySize = 256 * 1024;
    /// <summary>A contract is several pages where a payslip is one.</summary>
    public const int MaximumTextLength = 60_000;
    public const int MinimumTextLength = 200;

    /// <summary>What a contract read costs against the budget, at roughly three payslips of text.</summary>
    public const int BudgetCost = 3;

    public static readonly string[] Fields = ["employer", "basis", "amount", "weeklyHours", "from", "quote", "why"];

    public const string SystemPrompt = """
        You read Australian employment contracts and letters of offer, and you report the
        ordinary pay rate the document states. You are not asked what anyone should be paid.

        Return a JSON object with exactly these keys, all strings:
        employer, basis, amount, weeklyHours, from, quote, why.

        REFUSING IS THE MAIN THING YOU DO. Return "" for amount, and explain in `why`,
        whenever any of the following is true. Do not resolve it, calculate it or pick the
        most likely one:

        1. The document states a base rate plus a loading, allowance, penalty or casual
           loading. "$25.00 per hour plus 25% casual loading" is NOT a rate of 25.00 and is
           NOT a rate of 31.25. Refuse it.
        2. The rate depends on a classification, level, grade, award or enterprise agreement
           that the document does not itself state a figure for.
        3. The document states more than one ordinary rate, for different periods, roles or
           people, and you cannot tell which one applies.
        4. The figure is a range, a minimum, an estimate, a projection, or "up to".
        5. The document states only a total package, superannuation-inclusive figure, or
           "salary package", rather than an ordinary rate or salary.
        6. You are not certain. An empty amount costs the person one minute of typing. A
           confident wrong one is compared against every payslip they own and produces a
           run of wrong accusations they may send to their employer.

        When the document does state one plain ordinary rate:
        - basis: "hourly" or "annual". Nothing else.
        - amount: the figure, plain, such as 32.50 or 76000.00. No currency symbol, no
          commas, no words.
        - weeklyHours: the ordinary hours a week the salary covers, such as 38.00, when the
          basis is annual and the document states them. "" otherwise.
        - from: the date this rate takes effect, YYYY-MM-DD, only if the document states it.
          "" if it does not. Do not use today's date. Do not use a signature date unless the
          document says the rate applies from signing.
        - employer: the employing entity as named in the document.
        - quote: THE EXACT SENTENCE from the document that states the rate, copied
          character for character, no more than 300 characters. This is checked against the
          document, and your whole answer is discarded if it does not appear there. Never
          paraphrase, correct, tidy or shorten it.
        - why: "" when you have given an amount.

        Never report a superannuation percentage, an overtime rate, a penalty rate, an
        allowance, a bonus, a commission or a notice period as the ordinary rate.
        """;

    public static void MapContractReader(this WebApplication app)
    {
        app.MapPost("/api/contract/read", async (HttpRequest request, HttpResponse response, IConfiguration configuration, PayslipReadLimiter limiter, OriginSecret origin) =>
        {
            response.Headers.CacheControl = "no-store";
            if (!request.HasJsonContentType())
                return Results.Json(new { message = "Send the contract text as JSON." }, statusCode: 415);

            var key = configuration["Anthropic:ApiKey"];
            if (string.IsNullOrWhiteSpace(key))
                return Results.Json(new
                {
                    available = false,
                    message = "Reading a contract is not configured on this deployment. Enter the rate from your contract instead.",
                }, statusCode: 503);

            using var buffer = new MemoryStream();
            var chunk = new byte[4096];
            int count;
            while ((count = await request.Body.ReadAsync(chunk, request.HttpContext.RequestAborted)) > 0)
            {
                if (buffer.Length + count > MaximumBodySize)
                    return Results.Json(new { message = "That contract is too long to read. Enter the rate yourself." }, statusCode: 413);
                buffer.Write(chunk, 0, count);
            }

            ContractReadRequest? input;
            try
            {
                input = JsonSerializer.Deserialize<ContractReadRequest>(buffer.ToArray(), new JsonSerializerOptions(JsonSerializerDefaults.Web));
            }
            catch (JsonException)
            {
                return Results.BadRequest(new { message = "Send the contract text as JSON." });
            }

            var text = input?.Text?.Trim() ?? string.Empty;
            if (text.Length < MinimumTextLength || text.Length > MaximumTextLength)
                return Results.BadRequest(new { message = "Send the text of one contract." });

            var decision = limiter.TryRead(PayslipReadLimiter.ClientKey(request, origin.Trusts(request)), BudgetCost);
            if (!decision.Allowed)
            {
                response.Headers["Retry-After"] = ((int)Math.Ceiling(decision.RetryAfter.TotalSeconds)).ToString(CultureInfo.InvariantCulture);
                return Results.Json(new { available = false, message = PayslipReadLimiter.Message(decision) }, statusCode: 429);
            }

            try
            {
                var facts = Verified(await Read(text, key!, request.HttpContext.RequestAborted), text);
                return Results.Ok(new { available = true, fields = facts });
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
                    message = "The contract could not be read. Enter the rate from your contract instead.",
                }, statusCode: 502);
            }
        }).WithName("ReadContract");
    }

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
                // `quote` is a sentence; everything else is a short field.
                var longest = field == "quote" ? 300 : field == "why" ? 300 : 120;
                facts[field] = read.Trim().Length > longest ? string.Empty : read.Trim();
            }
            // Only the two bases this app understands. Anything else is nothing.
            if (facts["basis"] is not ("hourly" or "annual")) facts["basis"] = string.Empty;
        }
        return facts;
    }

    /*
     * A rate is believed only when the sentence it came from is in the contract.
     *
     * This is the defence the payslip reader does not need. It makes the failure
     * that matters — a rate that is not in the document — require the model to
     * also invent a sentence that is, which a schema-constrained answer copied
     * from the text will not do by accident.
     *
     * Whitespace is normalised on both sides before comparing, because a PDF
     * breaks lines where the page ends rather than where the sentence does.
     * Nothing else is loosened: a paraphrase does not match, and a paraphrase is
     * exactly what a rate that was inferred rather than read looks like.
     */
    public static Dictionary<string, string> Verified(Dictionary<string, string> facts, string text)
    {
        if (facts["amount"].Length == 0) return facts;
        var quote = Flattened(facts["quote"]);
        if (quote.Length >= 8 && Flattened(text).Contains(quote, StringComparison.OrdinalIgnoreCase)) return facts;

        facts["amount"] = string.Empty;
        facts["basis"] = string.Empty;
        facts["weeklyHours"] = string.Empty;
        facts["from"] = string.Empty;
        facts["quote"] = string.Empty;
        facts["why"] = "The rate that came back could not be found in your contract, so it has not been used. Enter it yourself from the document.";
        return facts;
    }

    private static string Flattened(string value) => string.Join(' ', value.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
}
