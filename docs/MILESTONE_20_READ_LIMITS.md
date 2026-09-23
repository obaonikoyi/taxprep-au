# Milestone 20 — what the assisted reader is allowed to spend

Status: **built and on by default.** No configuration is needed to get the
limits; configuration only moves them.

## Why

[Milestone 19](MILESTONE_19_ASSISTED_PAYSLIP_READER.md) shipped with one thing
written across it in bold: *the endpoint is open to anyone who can reach the
site once a key is set, and each call costs the key's owner money. It must not
be switched on for a public deployment until this exists.*

This is that. Until it existed, the only thing between a bored visitor and a
four-figure bill was their patience.

## Two limits, and they are not the same kind of thing

| | Counts | Worth |
|---|---|---|
| **Global** | Every read, by everyone | The guard. Nothing a caller sends can raise it, so it is what actually bounds the bill. |
| **Per client** | One caller's reads | Fairness. It stops the first person to arrive using up the day's budget before anyone else gets a turn. |

The per-client limit is keyed on the caller's address. Behind Cloudflare the
origin sees Cloudflare's address, so the visitor's own address arrives in the
`CF-Connecting-IP` header — and a header is written by whoever sends the
request. Anyone who finds the Railway origin directly can put a different
address in it on every request and look like a thousand people.

That hole is deliberate, and this is the honest statement of it: **per-client
limits are for sharing, not for defence.** Closing it means pinning Cloudflare's
address ranges and keeping that list current, which is worth doing when there is
something behind this endpoint worth more than a budget the global limit already
bounds. The global limit does not care what the header says.

Two smaller things the key does do:

- An IPv6 caller is counted by their **/64**, not their address. A single phone
  is handed a whole /64 and can use a new address in it for every request, so
  counting full addresses would count nobody.
- A header that is not an address is ignored rather than used, so the key is
  always a parsed address and never whatever was sent.

## The numbers, and what they cost

| Setting | Default | Why that number |
|---|---|---|
| `Payslips:ReadLimits:PerClientPerHour` | 40 | A batch is at most 20 payslips, so two full batches back to back never meet a limit mid-batch |
| `Payslips:ReadLimits:PerClientPerDay` | 60 | A financial year is 26 fortnightly or 52 weekly payslips: a whole year in one sitting, with room to redo some |
| `Payslips:ReadLimits:GlobalPerHour` | 60 | |
| `Payslips:ReadLimits:GlobalPerDay` | 150 | The bill |

A read costs at most about eight cents at this endpoint's own ceilings (20,000
characters of payslip text in, 2,048 tokens out, at Claude Opus 5 rates of $5
and $25 per million tokens) and nearer two cents for a payslip of ordinary
length. So `GlobalPerDay: 150` is an outer bound of roughly **twelve dollars a
day**, and more usually under three.

That is the number to change. It is one setting, it needs no code change, and
the arithmetic above says what moving it costs.

Set any limit to `0` to refuse every read while leaving the key configured —
which is how to switch the reader off without touching the key. A limit that is
negative, mistyped or not a number falls back to its default rather than
stopping the app from starting, and never becomes no limit at all.

## What a refused caller sees

`429`, a `Retry-After` header in seconds, and a message that says when the
reader is available again and what to do in the meantime:

> You have had a lot of payslips read recently. The assisted reader is available
> to you again in about 12 minutes. Enter the figures from this payslip
> instead — that always works.

Manual entry is always offered, because it always works. The app already shows
the server's own message for any refusal, so nothing in the browser needed to
learn about limits.

## Decisions worth knowing about

**Every limit is checked before any of them is charged.** Charging as we go
would let a caller who is going to be refused anyway spend the global budget on
the way to being refused — which is exactly the person the global budget exists
to stop.

**Counted as close to the spend as the code gets** — after the key check, the
body read and the text validation, immediately before the model is asked
anything. A deployment with no key spends nothing however many requests arrive,
so it answers 503 as it always did; and a malformed request, which was never
going to cost money, cannot use up anyone's allowance. Otherwise a caller could
lock the reader out for a day with requests that cost nothing to refuse.

**Fixed windows, not sliding.** A window's quota can be spent at the end of one
window and the start of the next, so a short-term burst can reach twice the
hourly limit. Over a day — the number that decides the bill — that does not
matter, and a fixed window can tell a caller exactly when to come back.

**A cancelled read stops costing money.** The caller's cancellation now reaches
the model call, so a browser that gave up — the reader times out after a
minute — no longer leaves a call running that is still billed for an answer
nobody will read. Milestone 19 left this out because the SDK's overload could
not be checked without a compiler; it has been checked, and it takes one.

**Memory cannot be grown by a caller.** An entry is only ever created for a read
that was *allowed*, and allowed reads are capped by the global limit, so someone
inventing a new address per request creates nothing after the budget is gone.

## Seeing where the budget is up to

A ceiling nobody can see is a hope. `GET /api/payslip/read/usage` answers with
the day's position:

```json
{
  "reader": "on",
  "windows": [
    { "name": "all reads this hour", "limit": 60,  "used": 1, "left": 59,  "resets": "2026-09-23T01:36:35Z" },
    { "name": "all reads today",     "limit": 150, "used": 1, "left": 149, "resets": "2026-09-24T00:36:35Z" }
  ],
  "callers": { "counted": 1, "busiest": 1 },
  "estimatedSpend": {
    "soFarUsd": 0.08,
    "ifFullyUsedUsd": 12.00,
    "note": "An estimate at 8c per read, which is this endpoint's own ceiling rather than what a payslip usually costs. It is not a bill."
  }
}
```

Set `Payslips:ReadLimits:UsageKey` to switch it on, then open
`…/api/payslip/read/usage?key=<the key>` in a browser, or send
`Authorization: Bearer <the key>`. `Payslips:ReadLimits:MaxCostCentsPerRead`
moves the estimate if the price does.

**Off until that key is set, and a wrong key gets the same 404 as an
unconfigured one** — nothing advertises that the path is there. Not because the
limits are secret, since they are written down in a public repository, but
because a live readout of how much budget is left is useful to somebody trying
to use it up. The key is compared as a SHA-256 digest, so the comparison takes
the same time whatever is sent; a plain string comparison returns sooner the
earlier two keys differ, which over enough attempts gives the key away a
character at a time.

**It never names a caller.** Global windows are reported in full; per-client
windows are counted and reported as two numbers — how many callers are being
counted, and the most any one of them has used. That answers the question an
operator actually has (*is one person taking an unusual share?*) without this
app being able to answer *who has been reading payslips here*, which it has no
business answering. An address is personal data. Two tests hold that line: one
serialises a snapshot taken after seven reads from a known address and asserts
the address is absent, and one walks every property name in the response and
fails on any that would carry where a request came from.

## Verification

- 62 backend tests: the counting itself, both layers and how they interact, the
  client key, the message, the configuration, the endpoint's 429, and the usage
  readout — its key, its shape, and the two assertions that keep an address out
  of it.
- Time is injected, not waited on. A limiter tested by sleeping is a suite that
  takes an hour, or one that fails on a slow runner.
- The endpoint test runs with a key configured and a limit of `0`, so it proves
  the whole path — configuration, wiring, refusal, `Retry-After`, message —
  without a key that works and without a network.
- One test asserts the limiter is a singleton, because a limit that forgets
  between requests is not a limit.
- One browser-side test asserts a 429's message reaches the person unchanged.
- All 104 backend tests were built and run here rather than in CI: the .NET SDK
  is installable in this environment after all, which it was assumed not to be
  for Milestone 19. Two real faults surfaced that a CI round trip would have
  found more slowly — the limiter read startup configuration where the endpoint
  read resolved configuration, so a host that layers settings on later handed
  the two different numbers; and one test passed for the wrong reason, because
  every refusal this endpoint gives offers manual entry.
- Four mutations were tried and all four were caught: charging each limit as it
  is checked rather than once all of them pass fails both the "a refused read is
  free" test and the memory-bound one; putting an address into the usage answer
  fails both privacy tests; and accepting a prefix of the usage key instead of
  comparing digests fails the near-miss key case.
- The usage readout was also driven against the running app rather than only
  through the test host: no key gives 404, a wrong key gives 404, the right key
  answers, and a read attempt moved every number in it — `used` 0 → 1 on both
  windows, `callers.counted` 0 → 1, and the estimate 0 → $0.08.

## Not done, deliberately

- ~~**Cloudflare's address ranges are not pinned.**~~ Addressed differently in
  [Milestone 24](MILESTONE_24_KNOWING_AND_TRUSTING.md): pinning them cannot work
  behind Railway's edge, so the header is believed only from a request carrying
  a shared secret instead. Off until configured.
- **The limits are per process.** Two instances of this app mean two budgets.
  Railway runs one; a second would need shared state, which is a database this
  project does not have and should not acquire for this.
- ~~**Nothing alerts anyone.**~~ [Milestone 24](MILESTONE_24_KNOWING_AND_TRUSTING.md)
  writes a warning to the log at 80% and again when a budget is gone. It is
  still a log line, so something has to read it.
- **A batch that meets a limit part way through loses the payslips already read
  in it.** The per-client limits are set so an ordinary batch cannot trip one,
  but someone who has already read 21 payslips this hour and starts a batch of
  20 will lose the ones that succeeded. That is how the reader has always
  handled a mid-batch failure; limits make it reachable, and it is worth fixing
  on its own rather than inside this change.
