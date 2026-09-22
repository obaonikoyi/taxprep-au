# Milestone 19 — the assisted payslip reader

Status: **built, and switched off in every deployment until a key is set.**

## Why

Xoba Paycheck reads three payslip layouts, all three invented here. No real
employer uses one. So a person with their own payslips meets the same sentence
every time — *this PDF layout is not supported yet* — and types about twelve
figures per document by hand.

That is the whole product, for them. They do it once and do not come back.

Every reader in this project until now has been a parser over a layout written
down in advance, which is precisely why it can be held to its arithmetic. That
was the right trade for correctness and the wrong one for use: it produced
something honest that nobody can be bothered to use twice. The convenient path
and the provable path pulled in opposite directions, and this milestone stops
pretending they don't.

## What it does

When a PDF matches no documented layout, and **only** if the person has asked
for it, the text pdf.js already extracted is sent to this app's own server,
which asks a model for the same twelve fields the app already holds. What comes
back is a proposal. It lands in the confirm screen every payslip already passes
through, with every field editable, and reaches no chart, total or rate check
until the person has confirmed it.

A documented layout is always read by its parser. The model is never asked
about a payslip we can already read properly.

## What leaves the device, and what does not

The PDF does not leave. pdf.js extracts the text in the browser, as it always
has, and only that text is sent — to this origin, not to a third party, so the
Content-Security-Policy is unchanged and the browser still talks to nobody else.
The server keeps nothing: no file, no log of the text, no record of the request.

It is still a real change to what the app promises, and it is not buried. The
choice sits **above** the file picker, not below it — a person cannot consent to
something they are shown after they have already chosen the file — and it says
what is sent, what is not, and that leaving it off means an unknown layout is
simply not read.

Off by default. Off in every deployment that has not configured a key.

## The one thing that must not go wrong

A payslip usually prints two columns: this pay, and year to date. A year-to-date
figure taken for a period figure does not look like an error — it looks like a
large pay — and it is then summed with every other period into a total wrong by
a year. Every documented parser here reads the period column only.

The system prompt leads with that rule, and a test asserts the rule is in the
prompt, because a prompt is a string and nothing else can check it. The prompt's
second theme is refusing: an empty field is a correct answer and costs nothing,
since the person is asked to check every field anyway, while a confident wrong
number costs everything.

## Where the guarantees live

| Guarantee | Held by |
|---|---|
| Only the twelve known fields, only as strings | `PayslipReaderEndpoint.Parse`, then again in `assistedFacts` |
| Nothing is read without asking | `assist` is false unless the checkbox is ticked, and the example payslips never use it |
| A proposal is not a reading | The payslip arrives `confirmed: false`, format `assisted-read-v1` |
| Nothing else leaves the browser | The payslip journey asserts the assisted read is the **only** POST in the whole journey |
| Off without a key | The endpoint answers 503 and the app offers manual entry |
| Bounded in what it can spend | [Milestone 20](MILESTONE_20_READ_LIMITS.md): a global limit no caller can raise |

Narrowing the answer twice — once on the server, once in the browser — is
deliberate. Either end could change without the other, and the app validates
every value again before it is shown regardless.

## Verification

- 14 backend tests over the answer boundary: the twelve fields, missing keys,
  extra keys, objects and arrays and nulls where a figure should be, unparseable
  answers, over-long values, and the endpoint's behaviour with no key.
- 11 browser-side tests over the same boundary and the request itself.
- The payslip journey, end to end in a real browser, with the server's answer
  stubbed: a PDF in a layout no parser matches reaches the endpoint, the request
  carries the extracted text and not the PDF, the proposal lands in the confirm
  fields, and it arrives needing confirmation.
- `sample-data/payslips/unknown-layout-example.json` is a fictional payslip in a
  layout deliberately unlike all three documented ones, so the path it exercises
  is the one a real employer's payslip would take.
- 425 tests, lint, build and all four render checks.

**The model call itself is not tested.** It needs a key and a network, and CI has
neither. What is tested is everything around it: what may be asked, what may be
believed, and what happens when the answer is unusable.

## Switching it on

Set `Anthropic__ApiKey` in the deployment's environment (Railway → Variables).
Nothing else changes; the endpoint notices the key and starts answering. Without
it the app behaves exactly as it did before this milestone.

Cost is per payslip read and falls on whoever set the key. How much it can cost
is bounded by the limits in [Milestone 20](MILESTONE_20_READ_LIMITS.md), which
are on by default and need no configuration.

## Not done, deliberately

- ~~**No rate limiting or abuse control.**~~ Built in
  [Milestone 20](MILESTONE_20_READ_LIMITS.md). The endpoint now refuses more
  reads than its configured limits allow, whoever asks.
- **Scans and photographs are still not read.** Only text the browser could
  already extract is sent; an image-only PDF extracts nothing and is still
  manual entry.
- **The reading is not checked against the document.** The person is the check,
  as they always have been. A second pass that verifies proposed figures against
  the extracted text would be a real improvement and is not here.
- **Contracts are still not read by a model.** That waits on the same operating
  model work it always has: a contract carries a salary, a signature and third
  parties, and it is a different decision from a payslip's figures.
