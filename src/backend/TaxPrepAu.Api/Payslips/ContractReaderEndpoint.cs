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

/*
 * One penalty rate a contract states, for a kind of day or time rather than
 * for ordinary hours. A contract expresses these one of two ways — "time and a
 * half on Saturdays" or "$40.26 per hour on Saturdays" — so exactly one of
 * Multiplier and Amount carries a figure and the other is empty.
 *
 * Quote is that penalty's own sentence, checked against the document like the
 * ordinary rate's. A penalty nobody can find in the contract is worse than no
 * penalty at all: it would be compared against a real payslip line and produce
 * a question about pay that the contract never raised.
 */
public sealed record ContractPenalty(string Kind, string Multiplier, string Amount, string Quote);

public static class ContractReaderEndpoint
{
    public const int MaximumBodySize = 256 * 1024;
    /// <summary>A contract is several pages where a payslip is one.</summary>
    public const int MaximumTextLength = 60_000;
    public const int MinimumTextLength = 200;

    /// <summary>What a contract read costs against the budget, at roughly three payslips of text.</summary>
    public const int BudgetCost = 3;

    public static readonly string[] Fields = ["employer", "basis", "amount", "weeklyHours", "from", "quote", "why"];

    /*
     * The kinds of penalty this app will record, and deliberately a closed
     * list. A casual loading is NOT here: it applies to every ordinary hour
     * rather than to a kind of day, so it changes what the ordinary rate IS
     * rather than sitting on top of it. A contract with one still refuses to
     * yield an ordinary rate, exactly as before.
     */
    public static readonly string[] PenaltyKinds = ["saturday", "sunday", "publicHoliday", "evening", "night", "overtime"];

    /// <summary>A contract states a handful of penalties; a list longer than this is a misreading.</summary>
    public const int MaximumPenalties = 12;

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

        PENALTY RATES are reported separately, in `penalties`, and never as the ordinary
        rate. Include one entry for each kind of day or time the document states a
        different rate for. Return [] when it states none, and when in any doubt.

        - kind: exactly one of saturday, sunday, publicHoliday, evening, night, overtime.
          Nothing else. A rate for a kind of day not on that list is left out entirely.
        - multiplier: the multiple of the ordinary rate, such as 1.5 or 1.75, when the
          document expresses it that way ("time and a half", "double time", "150% of the
          ordinary rate"). "" otherwise.
        - amount: the figure in dollars an hour, such as 40.26, when the document states a
          flat rate for that day instead. "" otherwise.
        - Exactly one of multiplier and amount carries a figure. Never both. If the
          document gives neither plainly, leave the entry out.
        - quote: THE EXACT SENTENCE stating that penalty, copied character for character,
          no more than 300 characters. Checked against the document like the rate's quote.
          Every penalty is discarded if any one of these cannot be found.

        A casual loading is not a penalty rate and does not go in this list. It applies to
        every ordinary hour rather than to a kind of day, so it changes what the ordinary
        rate is; rule 1 above still applies to it.

        Leave a penalty out rather than working one out. A clause saying only that
        penalty rates apply as per the award states no figure and yields no entry.
        A range, a minimum or an "up to" yields no entry.
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
                var reading = await Read(text, key!, request.HttpContext.RequestAborted);
                /*
                 * A reading whose own rate sentence is not in the contract is not
                 * believed about penalties either. Each penalty still has to carry
                 * a sentence of its own; this is the case where the answer as a
                 * whole has already shown it will invent one.
                 */
                var invented = reading.Facts["amount"].Length > 0 && !QuoteFound(reading.Facts["quote"], text);
                var facts = Verified(reading.Facts, text);
                var penalties = invented ? [] : VerifiedPenalties(reading.Penalties, text);
                return Results.Ok(new { available = true, fields = facts, penalties });
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
        // The kind is an enum in the schema, so a day this app has no rule for
        // cannot come back at all rather than being filtered out afterwards.
        properties["penalties"] = new
        {
            type = "array",
            maxItems = MaximumPenalties,
            items = new
            {
                type = "object",
                properties = new
                {
                    kind = new { type = "string", @enum = PenaltyKinds },
                    multiplier = new { type = "string" },
                    amount = new { type = "string" },
                    quote = new { type = "string" },
                },
                required = new[] { "kind", "multiplier", "amount", "quote" },
                additionalProperties = false,
            },
        };
        return new Dictionary<string, JsonElement>
        {
            ["type"] = JsonSerializer.SerializeToElement("object"),
            ["properties"] = JsonSerializer.SerializeToElement(properties),
            ["required"] = JsonSerializer.SerializeToElement(Fields.Append("penalties").ToArray()),
            ["additionalProperties"] = JsonSerializer.SerializeToElement(false),
        };
    }

    private static async Task<(Dictionary<string, string> Facts, List<ContractPenalty> Penalties)> Read(string text, string apiKey, CancellationToken cancellationToken)
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
        return (Parse(json), ParsePenalties(json));
    }

    /*
     * The penalty list, narrowed to what this app will act on. A figure that is
     * not a plain number is dropped, an entry carrying both a multiplier and a
     * flat amount is dropped because the contract cannot have meant both, and
     * one carrying neither is dropped because there is nothing to compare.
     */
    public static List<ContractPenalty> ParsePenalties(string json)
    {
        var penalties = new List<ContractPenalty>();
        if (string.IsNullOrWhiteSpace(json)) return penalties;

        JsonDocument document;
        try { document = JsonDocument.Parse(json); }
        catch (JsonException) { return penalties; }

        using (document)
        {
            if (document.RootElement.ValueKind != JsonValueKind.Object) return penalties;
            if (!document.RootElement.TryGetProperty("penalties", out var list) || list.ValueKind != JsonValueKind.Array) return penalties;

            foreach (var entry in list.EnumerateArray())
            {
                if (penalties.Count >= MaximumPenalties) break;
                if (entry.ValueKind != JsonValueKind.Object) continue;
                var kind = Text(entry, "kind", 40);
                if (!PenaltyKinds.Contains(kind, StringComparer.Ordinal)) continue;

                var multiplier = Figure(Text(entry, "multiplier", 40));
                var amount = Figure(Text(entry, "amount", 40));
                // One or the other, never both and never neither.
                if ((multiplier.Length == 0) == (amount.Length == 0)) continue;

                var quote = Text(entry, "quote", 300);
                if (quote.Length == 0) continue;
                // The same kind twice means the contract was not read cleanly.
                if (penalties.Any(p => p.Kind == kind)) continue;
                penalties.Add(new ContractPenalty(kind, multiplier, amount, quote));
            }
        }
        return penalties;
    }

    private static string Text(JsonElement entry, string name, int longest)
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

    /// <summary>A plain positive number and nothing else: no symbols, no words, no ranges.</summary>
    private static string Figure(string value)
        => System.Text.RegularExpressions.Regex.IsMatch(value, @"^\d{1,7}(?:\.\d{1,4})?$")
            && decimal.Parse(value, CultureInfo.InvariantCulture) > 0
            ? value : string.Empty;

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
        if (QuoteFound(facts["quote"], text)) return facts;

        facts["amount"] = string.Empty;
        facts["basis"] = string.Empty;
        facts["weeklyHours"] = string.Empty;
        facts["from"] = string.Empty;
        facts["quote"] = string.Empty;
        facts["why"] = "The rate that came back could not be found in your contract, so it has not been used. Enter it yourself from the document.";
        return facts;
    }

    /// <summary>Is this sentence actually in the contract? Whitespace flattened on both
    /// sides, because a PDF breaks lines where the page ends rather than where the
    /// sentence does. Nothing else is loosened.</summary>
    public static bool QuoteFound(string quote, string text)
    {
        var flat = Flattened(quote);
        return flat.Length >= 8 && Flattened(text).Contains(flat, StringComparison.OrdinalIgnoreCase);
    }

    /*
     * Penalties, all or nothing.
     *
     * One unfindable sentence discards every penalty rather than just its own.
     * A model that produced a sentence the contract does not contain has not
     * earned belief about the others, and the cost of being wrong here is not
     * a missing feature — it is the app telling somebody their Saturday pay
     * does not match a contract term that was never in their contract.
     *
     * The ordinary rate is left alone: it carries its own quote and its own
     * check, and losing it too would punish a good reading for a bad one.
     */
    public static List<ContractPenalty> VerifiedPenalties(List<ContractPenalty> penalties, string text)
    {
        foreach (var penalty in penalties)
            if (!QuoteFound(penalty.Quote, text)) return [];
        return penalties;
    }

    private static string Flattened(string value) => string.Join(' ', value.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
}
