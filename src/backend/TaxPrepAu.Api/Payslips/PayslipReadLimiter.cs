using System.Globalization;
using System.Net;
using System.Net.Sockets;

namespace TaxPrepAu.Api.Payslips;

/*
 * What the assisted reader is allowed to spend.
 *
 * Every call to /api/payslip/read costs whoever configured the key real money,
 * and the endpoint is open to anyone who can load the site. Without a ceiling
 * the only thing standing between a bored visitor and a four-figure bill is
 * their patience. This is that ceiling.
 *
 * Two layers, and they are not the same kind of thing:
 *
 *   The global limit is the guard. It counts every read by everyone, and
 *   nothing a caller sends can raise it. It is what actually bounds the bill.
 *
 *   The per-client limit is fairness. It stops one person using up the global
 *   budget before anyone else arrives. It is keyed on the caller's address,
 *   which behind Cloudflare arrives in a header — and a header is set by
 *   whoever sends the request. Someone who finds the origin directly can put
 *   any address they like in it and appear to be a thousand different people.
 *   That is a real hole and it is deliberate: closing it means pinning the
 *   trusted proxy addresses and keeping that list current, which is worth doing
 *   when there is something to protect beyond a budget the global limit already
 *   bounds. Until then the honest statement is that per-client limits are for
 *   sharing, not for defence.
 *
 * Fixed windows, not sliding. A window's worth of quota can be spent at the end
 * of one window and the start of the next, so the true short-term burst is up
 * to twice the hourly limit. Over a day — the number that decides the bill —
 * that does not matter, and a fixed window gives the caller an exact and
 * truthful answer to "when can I try again".
 */
public sealed record ReadLimit(string Name, bool PerClient, int Limit, TimeSpan Window);

public sealed record ReadLimitDecision(bool Allowed, TimeSpan RetryAfter, ReadLimit? Reached)
{
    public static readonly ReadLimitDecision Pass = new(true, TimeSpan.Zero, null);
}

/// <summary>One limit's state. <paramref name="Resets"/> is null while nothing has been counted into it.</summary>
public sealed record WindowUsage(string Name, TimeSpan Window, int Limit, int Used, DateTimeOffset? Resets);

/// <summary>
/// What the limiter has counted. <paramref name="Busiest"/> is the most any one
/// caller has used in any window, which says whether a single caller is taking
/// an unusual share without saying who they are.
/// </summary>
public sealed record LimiterUsage(IReadOnlyList<WindowUsage> Windows, int Clients, int Busiest);

public sealed class PayslipReadLimiter
{
    /// <summary>The partition every non-per-client limit counts into.</summary>
    public const string Everyone = "*";
    private const string Unknown = "unknown";

    // Entries are only ever created for a read that was allowed, and allowed
    // reads are capped by the global limits, so the number of entries is bounded
    // by the configuration rather than by how many addresses a caller invents.
    // The sweep is for a deployment configured with much larger numbers.
    private const int SweepAbove = 256;

    private sealed class Counted
    {
        public DateTimeOffset Ends;
        public int Count;
        /// <summary>0 nothing said, 1 the near-the-limit warning, 2 the limit itself.</summary>
        public int Announced;
    }

    private readonly IReadOnlyList<ReadLimit> limits;
    private readonly Func<DateTimeOffset> clock;
    private readonly Action<string> warn;
    private readonly int warnAt;
    private readonly Dictionary<(string Rule, string Client), Counted> counted = new();
    private readonly object gate = new();

    /*
     * `warn` is how an operator finds out a budget is running out before the
     * bill does. It is called at most twice per window — once approaching the
     * limit, once on reaching it — because a warning on every request is a
     * warning nobody reads.
     *
     * Only the global windows are announced. One person reaching their own
     * limit is the limit working, and is nobody else's business.
     */
    public PayslipReadLimiter(IReadOnlyList<ReadLimit> limits, Func<DateTimeOffset> clock, Action<string>? warn = null, int warnAt = 80)
    {
        this.limits = limits;
        this.clock = clock;
        this.warn = warn ?? (_ => { });
        this.warnAt = Math.Clamp(warnAt, 1, 100);
    }

    /// <summary>The limits in force, for the milestone document and for tests.</summary>
    public IReadOnlyList<ReadLimit> Limits => limits;

    /// <summary>How many windows are being tracked. Only a test has any use for this.</summary>
    public int Tracked { get { lock (gate) return counted.Count; } }

    /*
     * What has been used, for whoever pays the bill.
     *
     * The global windows are reported in full. Per-client windows are counted
     * and never named: an address is personal data, and answering "who has been
     * reading payslips here" is not something this app should be able to do,
     * whoever is asking. What an operator actually needs from that side is
     * whether one caller is taking an unusual share, and a number answers that
     * without identifying anybody.
     */
    public LimiterUsage Usage()
    {
        var now = clock();
        lock (gate)
        {
            var windows = limits
                .Where(limit => !limit.PerClient)
                .Select(limit =>
                {
                    var window = Active(limit, Everyone, now);
                    return new WindowUsage(limit.Name, limit.Window, limit.Limit, window?.Count ?? 0, window?.Ends);
                })
                .ToList();

            var live = counted.Where(entry => entry.Value.Ends > now && entry.Key.Client != Everyone).ToList();
            return new LimiterUsage(
                windows,
                live.Select(entry => entry.Key.Client).Distinct().Count(),
                live.Count == 0 ? 0 : live.Max(entry => entry.Value.Count));
        }
    }

    /*
     * The defaults are a deliberate choice about money, not a guess.
     *
     * A read costs at most about eight cents at this endpoint's ceilings (20,000
     * characters in, 2,048 tokens out) and nearer two cents in practice, so 150
     * reads a day is an outer bound of roughly twelve dollars a day and more
     * usually under three. Raise GlobalPerDay and that number moves with it.
     *
     * The per-client numbers are set against how the app is actually used: a
     * batch is at most 20 payslips, and a financial year is 26 fortnightly or 52
     * weekly ones. 40 an hour means two full batches back to back without ever
     * meeting a limit mid-batch, and 60 a day covers a full year of payslips in
     * one sitting with room to redo some.
     *
     * A limit of 0 is honoured, and switches the reader off while leaving the
     * key configured.
     */
    public static PayslipReadLimiter FromConfiguration(IConfiguration configuration, Func<DateTimeOffset>? clock = null, Action<string>? warn = null)
    {
        // Read as text and parsed here rather than bound: a mistyped limit should
        // fall back to a number that holds, not stop the app from starting and
        // not quietly become no limit at all.
        int Configured(string name, int fallback)
        {
            var value = configuration[$"Payslips:ReadLimits:{name}"];
            return int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var limit) && limit >= 0
                ? limit : fallback;
        }
        return new PayslipReadLimiter(
        [
            new("your reads this hour", true, Configured("PerClientPerHour", 40), TimeSpan.FromHours(1)),
            new("your reads today", true, Configured("PerClientPerDay", 60), TimeSpan.FromDays(1)),
            new("all reads this hour", false, Configured("GlobalPerHour", 60), TimeSpan.FromHours(1)),
            new("all reads today", false, Configured("GlobalPerDay", 150), TimeSpan.FromDays(1)),
        ], clock ?? (() => DateTimeOffset.UtcNow), warn, Configured("WarnAtPercent", 80));
    }

    /*
     * Every limit is examined before any of them is charged. Charging as we go
     * would let a caller who is going to be refused anyway spend the global
     * budget on the way to being refused, which is precisely the person the
     * global budget exists to stop.
     */
    public ReadLimitDecision TryRead(string client)
    {
        var now = clock();
        lock (gate)
        {
            if (counted.Count > SweepAbove)
                foreach (var key in counted.Where(e => e.Value.Ends <= now).Select(e => e.Key).ToList())
                    counted.Remove(key);

            ReadLimitDecision? refused = null;
            foreach (var limit in limits)
            {
                var window = Active(limit, client, now);
                if ((window?.Count ?? 0) < limit.Limit) continue;
                // Report the longest wait, so a caller told to come back in a
                // minute is not refused again a minute later by a daily limit.
                var wait = window is null ? limit.Window : window.Ends - now;
                if (refused is null || wait > refused.RetryAfter) refused = new ReadLimitDecision(false, wait, limit);
            }
            if (refused is not null) return refused;

            foreach (var limit in limits)
            {
                var key = Key(limit, client);
                var window = Active(limit, client, now);
                if (window is null) counted[key] = new Counted { Ends = now + limit.Window, Count = 1 };
                else window.Count++;
                if (!limit.PerClient) Announce(limit, counted[key], now);
            }
            return ReadLimitDecision.Pass;
        }
    }

    /// <summary>Say something once when a global budget is nearly gone, and once when it is.</summary>
    private void Announce(ReadLimit limit, Counted window, DateTimeOffset now)
    {
        if (limit.Limit <= 0) return;
        var level = window.Count >= limit.Limit ? 2 : window.Count * 100 >= limit.Limit * warnAt ? 1 : 0;
        if (level <= window.Announced) return;
        window.Announced = level;
        var until = (window.Ends - now).TotalMinutes;
        warn(level == 2
            ? $"Assisted payslip reader: \"{limit.Name}\" is fully used ({window.Count} of {limit.Limit}). Reads are being refused for the next {until:F0} minutes."
            : $"Assisted payslip reader: \"{limit.Name}\" is {window.Count * 100 / limit.Limit}% used ({window.Count} of {limit.Limit}), with {until:F0} minutes left in the window.");
    }

    private static (string, string) Key(ReadLimit limit, string client) => (limit.Name, limit.PerClient ? client : Everyone);

    private Counted? Active(ReadLimit limit, string client, DateTimeOffset now)
        => counted.TryGetValue(Key(limit, client), out var window) && window.Ends > now ? window : null;

    /// <summary>What to tell the person. It always ends in something that works.</summary>
    public static string Message(ReadLimitDecision decision)
    {
        var minutes = Math.Max(1, (int)Math.Ceiling(decision.RetryAfter.TotalMinutes));
        var wait = minutes <= 90 ? $"{minutes} minute{(minutes == 1 ? "" : "s")}" : $"{Math.Max(2, (int)Math.Round(decision.RetryAfter.TotalHours))} hours";
        return decision.Reached?.PerClient == true
            ? $"You have had a lot of payslips read recently. The assisted reader is available to you again in about {wait}. Enter the figures from this payslip instead — that always works."
            : $"The assisted reader has reached its limit for now. It is available again in about {wait}. Enter the figures from your payslip instead — that always works.";
    }

    /*
     * Who is asking. Cloudflare puts the visitor's address in CF-Connecting-IP
     * and the origin sees Cloudflare's own address, so the header is the only
     * way to tell two visitors apart — with the caveat at the top of this file
     * about what that is and is not worth.
     */
    public static string ClientKey(HttpRequest request, bool trustForwarded = true)
    {
        // A request that did not come through our own front door has no
        // standing to say where it came from, so only the address of the
        // connection itself is believed. See OriginSecret.
        foreach (var name in trustForwarded ? new[] { "CF-Connecting-IP", "X-Forwarded-For" } : [])
        {
            var header = request.Headers[name].ToString();
            // A header is written by the caller: read a bounded amount of it and
            // keep nothing that is not an address.
            if (header.Length is 0 or > 1000) continue;
            if (Normalised(header.Split(',')[0].Trim()) is { } address) return address;
        }
        return Normalised(request.HttpContext.Connection.RemoteIpAddress?.ToString() ?? string.Empty) ?? Unknown;
    }

    private static string? Normalised(string candidate)
    {
        if (!IPAddress.TryParse(candidate, out var address)) return null;
        if (address.IsIPv4MappedToIPv6) address = address.MapToIPv4();
        if (address.AddressFamily != AddressFamily.InterNetworkV6) return address.ToString();
        // A single phone is handed a whole /64 and can use a different address
        // in it for every request, so counting full IPv6 addresses would count
        // nobody. The /64 is the household.
        var bytes = address.GetAddressBytes();
        Array.Clear(bytes, 8, 8);
        return new IPAddress(bytes).ToString() + "/64";
    }
}
