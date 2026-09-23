using System.Security.Cryptography;
using System.Text;

namespace TaxPrepAu.Api.Payslips;

/*
 * What the assisted reader has spent, for whoever pays for it.
 *
 * Milestone 20 gave the reader a ceiling. A ceiling nobody can see is a hope:
 * the only feedback loop was the bill, which arrives a month late. This says
 * where the day's budget is up to, right now.
 *
 * It is off unless a key is configured, and a wrong key gets the same 404 as
 * an unconfigured one, so nothing advertises that this path exists. That is
 * not because the limits are secret — they are written down in a public
 * repository — but because a live readout of how much budget is left is
 * genuinely useful to somebody trying to use it up.
 *
 * It never names a caller. Per-client windows are counted and reported as a
 * number, never an address: an address is personal data, and "who has been
 * reading payslips here" is not a question this app should be able to answer.
 */
public static class PayslipReadUsageEndpoint
{
    public const string Route = "/api/payslip/read/usage";

    /*
     * An estimate, not a bill. A read is bounded by this endpoint's own
     * ceilings: 20,000 characters of payslip text in (about 5,000 tokens, $5
     * per million) and 2,048 tokens out ($25 per million), which is 2.5c + 5.1c
     * and rounds to 8. An ordinary payslip costs nearer 2c. Configurable,
     * because the price is somebody else's to change.
     */
    public const int DefaultMaximumCostCents = 8;

    public static void MapPayslipReadUsage(this WebApplication app)
    {
        app.MapGet(Route, (HttpRequest request, HttpResponse response, IConfiguration configuration, PayslipReadLimiter limiter) =>
        {
            response.Headers.CacheControl = "no-store";
            var expected = configuration["Payslips:ReadLimits:UsageKey"];
            if (string.IsNullOrWhiteSpace(expected) || !Matches(Offered(request), expected))
                return Results.NotFound();

            var usage = limiter.Usage();
            var cents = Cents(configuration);
            // The longest window is the one that decides a day's spend.
            var longest = usage.Windows.OrderByDescending(window => window.Window).FirstOrDefault();

            return Results.Ok(new
            {
                reader = string.IsNullOrWhiteSpace(configuration["Anthropic:ApiKey"]) ? "off" : "on",
                windows = usage.Windows.Select(window => new
                {
                    name = window.Name,
                    limit = window.Limit,
                    used = window.Used,
                    left = Math.Max(0, window.Limit - window.Used),
                    resets = window.Resets,
                }),
                // Counted, never named. See the comment at the top of this file.
                callers = new { counted = usage.Clients, busiest = usage.Busiest },
                estimatedSpend = new
                {
                    soFarUsd = Usd(longest?.Used ?? 0, cents),
                    ifFullyUsedUsd = Usd(longest?.Limit ?? 0, cents),
                    note = $"An estimate at {cents}c per read, which is this endpoint's own ceiling rather than what a payslip usually costs. It is not a bill.",
                },
            });
        }).WithName("ReadPayslipUsage");
    }

    private static int Cents(IConfiguration configuration)
        => int.TryParse(configuration["Payslips:ReadLimits:MaxCostCentsPerRead"], out var cents) && cents >= 0
            ? cents : DefaultMaximumCostCents;

    private static decimal Usd(int reads, int cents) => Math.Round(reads * cents / 100m, 2);

    /// <summary>A browser can use <c>?key=</c>; anything else should send a bearer token.</summary>
    private static string Offered(HttpRequest request)
    {
        var header = request.Headers.Authorization.ToString();
        const string bearer = "Bearer ";
        if (header.StartsWith(bearer, StringComparison.OrdinalIgnoreCase)) return header[bearer.Length..].Trim();
        return request.Query["key"].ToString();
    }

    /*
     * Compared as digests so the comparison is the same length and the same
     * duration whatever is sent. Comparing the strings themselves would return
     * faster the sooner they differ, which over enough attempts tells an
     * attacker the key one character at a time.
     */
    private static bool Matches(string offered, string expected)
    {
        if (offered.Length == 0) return false;
        return CryptographicOperations.FixedTimeEquals(
            SHA256.HashData(Encoding.UTF8.GetBytes(offered)),
            SHA256.HashData(Encoding.UTF8.GetBytes(expected)));
    }
}
