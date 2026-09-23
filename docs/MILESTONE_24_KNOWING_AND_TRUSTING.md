# Milestone 24 — knowing the budget is going, and knowing who is asking

Status: **built.** Both parts do nothing until configured, and configuring
neither leaves the app exactly as it was.

## Part one: saying something before the bill does

[Milestone 20](MILESTONE_20_READ_LIMITS.md) gave the assisted reader a ceiling
and [Milestone 20's readout](MILESTONE_20_READ_LIMITS.md#seeing-where-the-budget-is-up-to)
made it visible — to somebody who goes and looks. Nothing came looking for you.

A warning is now written to the log **twice per window and no more**: once when
a global budget passes 80% used, and once when it is gone and reads are being
refused.

```
warn: Payslips.ReadLimits[0]
      Assisted payslip reader: "all reads today" is 80% used (120 of 150), with 431 minutes left in the window.
warn: Payslips.ReadLimits[0]
      Assisted payslip reader: "all reads today" is fully used (150 of 150). Reads are being refused for the next 388 minutes.
```

Twice, because a warning on every request is a warning nobody reads.
`Payslips:ReadLimits:WarnAtPercent` moves the first one.

**Only the global windows are announced.** One person reaching their own limit
is the limit working, and is nobody else's business.

This is a log line rather than an email or a push, because those need a
provider, a secret and an address, and the log is already somewhere the
operator looks — Railway will alert on a pattern in it if asked to.

## Part two: knowing the request came through our own front door

Milestone 20 said this plainly and left it open:

> Anyone who finds the Railway origin directly can put a different address in
> `CF-Connecting-IP` on every request and look like a thousand people.
> **Per-client limits are for sharing, not for defence.**

The obvious fix is to trust that header only from Cloudflare's own addresses.
**On this deployment that does not work, and would quietly make things worse.**

Railway terminates TLS at its own edge and forwards to the container over its
internal network — `User → Edge POP → internal routing → your service`. The
address the container sees is Railway's, never Cloudflare's. An allowlist of
Cloudflare ranges would match nothing, every visitor would fall back to sharing
a single address, and the per-client limit would start refusing real people.

What works is a secret only our own front door knows.

| | |
|---|---|
| Cloudflare | adds a header carrying a secret to every request it forwards |
| The origin | believes `CF-Connecting-IP` only from a request carrying that secret |
| Anyone else | is counted by the address of their connection, which they cannot change per request |

The secret is compared as a SHA-256 digest, so the comparison takes the same
time whatever is sent — a plain string comparison returns sooner the earlier
two values differ, which over enough attempts gives the secret away a character
at a time.

### Setting it up

1. Pick a long random string.
2. **Railway → Variables:** `Payslips__OriginSecret__Value` = that string.
   (`Payslips__OriginSecret__Header` changes the header name from the default
   `X-Origin-Secret` if you want a different one.)
3. **Cloudflare → Rules → Transform Rules → Modify Request Header → Create:**
   set a static header, name `X-Origin-Secret`, value the same string. Apply to
   all incoming requests.

Get the order right: **Cloudflare first, Railway second.** Setting the variable
before the rule exists means no request carries the secret, so every visitor is
counted as one caller until the rule is added.

### Unset by default, and that is deliberate

Without it, forwarded headers are read exactly as before. A deployment that has
not configured this is no worse off than it was, and the global limit — which
no header can raise — is still the thing that bounds the bill.

## Verification

- 17 backend tests (141 total): the secret believed, refused for a wrong value,
  a near-miss, a trailing space, an absent header and an absurdly long one; a
  configurable header name; the client key falling back to the connection when
  a request is not believed; the warning fired once near the limit and once at
  it, never repeated across 200 further requests, never fired for one person's
  own limit, and movable with `WarnAtPercent`.
- **Mutation-checked:** making the secret believe every request fails six of
  those tests.

## Not done

- **The secret is one string with no rotation.** Changing it means changing the
  Cloudflare rule and the Railway variable, and requests in flight between the
  two are counted by connection address. For a deployment this size that is a
  few seconds of coarser limiting, not an outage.
- **Nothing counts how often an untrusted request arrives.** That number would
  say whether anyone is actually trying, and it is not collected — counting it
  per address would mean keeping addresses, which this app deliberately does
  not do.
- **Still a log line, not an alert.** Somebody or something has to read it.
