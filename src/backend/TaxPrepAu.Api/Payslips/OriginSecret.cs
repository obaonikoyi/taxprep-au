using System.Security.Cryptography;
using System.Text;

namespace TaxPrepAu.Api.Payslips;

/*
 * Telling a request that came through our own front door from one that did not.
 *
 * The per-client read limit is keyed on the address in CF-Connecting-IP, and
 * [Milestone 20](../../../../docs/MILESTONE_20_READ_LIMITS.md) said plainly
 * that anyone reaching the origin directly can put whatever they like in that
 * header and look like a thousand people.
 *
 * The obvious fix — only trust the header when the request came from one of
 * Cloudflare's own addresses — does not work on this deployment, and would
 * quietly make things worse. Railway terminates TLS at its own edge and
 * forwards to the container over its internal network, so the address the
 * container sees is Railway's, never Cloudflare's. An allowlist of Cloudflare
 * ranges would match nothing, every visitor would fall back to sharing one
 * address, and the per-client limit would start refusing real people.
 *
 * What does work is a secret only our own front door knows. Cloudflare adds a
 * header with it (Rules -> Transform Rules -> Modify Request Header), and a
 * request arriving without it is a request that did not come through
 * Cloudflare — whatever it claims about where it came from.
 *
 * Unset by default, and then nothing changes: the header is read as before.
 * That is deliberate. A deployment that has not configured this is no worse off
 * than it was, and the global limit — which no header can raise — is still the
 * thing that bounds the bill.
 */
public sealed class OriginSecret
{
    private readonly string header;
    private readonly byte[]? expected;

    private OriginSecret(string header, byte[]? expected)
    {
        this.header = header;
        this.expected = expected;
    }

    public const string DefaultHeader = "X-Origin-Secret";

    /// <summary>False when nothing is configured, in which case forwarded headers are read as they always were.</summary>
    public bool Configured => expected is not null;

    public static OriginSecret FromConfiguration(IConfiguration configuration)
    {
        var value = configuration["Payslips:OriginSecret:Value"];
        var name = configuration["Payslips:OriginSecret:Header"];
        return new OriginSecret(
            string.IsNullOrWhiteSpace(name) ? DefaultHeader : name.Trim(),
            string.IsNullOrWhiteSpace(value) ? null : SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    }

    /*
     * Whether this request's forwarded headers may be believed. Compared as
     * digests so the comparison takes the same time whatever is sent: a plain
     * string comparison returns sooner the earlier two values differ, which
     * over enough attempts gives the secret away a character at a time.
     */
    public bool Trusts(HttpRequest request)
    {
        if (expected is null) return true;
        var offered = request.Headers[header].ToString();
        if (offered.Length is 0 or > 1000) return false;
        return CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(offered)), expected);
    }
}
