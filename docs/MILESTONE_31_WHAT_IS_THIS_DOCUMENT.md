# Milestone 31 — what is this document, and whose is it

Status: **built.** Both questions ride the reading that already happens, so
neither costs a request or a budget unit. Off unless a key is configured.

## Where these came from

[A catalogue of scenarios](SCENARIOS_WHAT_CAN_GO_IN.md) written before building,
asking what people actually hand an app like this. Half of it was reassurance —
the file gate, batch handling and two-jobs support hold up. Two things did not.

## 1. Nothing said what the document was

The only guard was **"all twelve fields came back empty."** That stops nonsense
and nothing else.

An ATO notice of assessment is not nonsense. It carries a name, an ABN, dates
and dollar amounts — exactly the shapes a payslip reader hunts for — and its
figures cover **a financial year**. Read as a payslip, a year is counted as a
fortnight: out by a factor of twenty-six, in a total nobody would question.

The reader is now asked **what the document is before it is asked what it says**,
in the same answer:

| kind | What it is |
|---|---|
| `payslip` | One pay period |
| `taxReturn` | Notice of assessment, tax return. **A year, not a fortnight** |
| `annualIncomeStatement` | Income statement or payment summary — a year |
| `bankStatement` | Transactions on an account |
| `employmentContract` | A contract or letter of offer |
| `invoice` | An invoice, receipt or bill |
| `other` | Anything it could not place |

A closed enum in the schema, so a kind this app has no sentence for cannot come
back. Anything unrecognised becomes `other` — **never blank**, because every
file needs an answer.

### What the screen says

> **This does not look like a payslip**
> • notice-of-assessment.pdf
>
> It looks like a tax return or notice of assessment. Its figures cover a whole
> financial year, not one pay period. Added to your pay history they would count
> a year as a fortnight.
>
> Nothing has been added to your pay history. If this really is a payslip, you
> can add it anyway.
>
> `[ Add it as a payslip anyway ]`  `[ Don't add it ]`

Three decisions in that:

**"Does not look like", never "is not."** The reading is an opinion and the
person is about to be offered the chance to disagree with it. A test asserts the
heading never says *is not*.

**Every kind is sent where it belongs** — a bank statement to the Bank spending
screen, a contract to Pay rate checks, an annual statement to the year-end step.
A refusal that does not say where to go is half an answer.

**The override costs nothing.** The figures were read once and held, so adding
it anyway sends no second request and spends no second budget unit.

**`other` is marked as the weaker claim it is.** Naming a kind is a judgement;
*"I could not place this"* is not, so the invitation to overrule is louder. This
is what protects a payslip in a layout nobody has ever seen.

One deliberate consequence: a document the reader names as a tax return comes
back with **empty figures**, because the prompt says so. Overruling it gives an
empty form to type into rather than a year's figures dressed as a fortnight. A
document it could not place keeps whatever it did read — otherwise the override
would be useless for the case it exists for.

## 2. Nothing knew whose payslip it was

**This app has no idea who you are**, by design. No account, no profile, no
stored name. Which is also why two people's payslips were both accepted and both
summed, and why a contract that was not yours could become the baseline every
payslip was compared against.

The answer is **not** an identity check. What the app can do is notice that the
documents in front of it disagree with each other:

> **These payslips are made out to different names**
> A pay summary that mixes two people's pay is wrong in a way nothing here can
> detect later, so it is worth a look:
> • mine.pdf
> • theirs.pdf
>
> Each line above is one name. If that is the same person written two ways,
> ignore this. If a file belongs to somebody else, open it and remove it.
>
> `[ They are the same person ]`

### The name never exists here

The reader returns the name; the browser reduces it to a **digest** and keeps
only that. Normalised first — case, spacing and punctuation folded — then
SHA-256, truncated.

| | |
|---|---|
| What is kept | 16 hex characters |
| What it can answer | "do these two documents differ" |
| What it cannot do | be shown beside a figure, written into a report, carried out in an export, or read back |

There is nothing there to leak. A test asserts that what comes out of the check
is file names and opaque keys, and nothing else.

**Why it is a question and never a refusal:** *"O. Onikoyi"* on one employer's
payslip and the full name on another's looks exactly like two people from here.
The check cannot do better than that, which is precisely why it is dismissible.

A document with no name is not evidence of anything — a documented layout states
none and manual entry states none — so one named document beside two unnamed
ones is not a disagreement.

## What is checked

| Invariant | How |
|---|---|
| Every kind has a sentence | All seven, asserted |
| The heading never claims certainty | No *"is not"* for any kind |
| A tax return is explained by the factor of twenty-six | "whole financial year", "count a year as a fortnight" |
| Each kind names where it belongs | Bank spending, Pay rate checks, year-end |
| `other` is the weaker claim | `unsure` true for it alone |
| Nothing unrecognised comes back blank | Garbage, numbers, null and nonsense all become `other` |
| A name too long is a misread field | 121 characters returns nothing |
| No name is not a second person | One digest beside two blanks is no disagreement |
| Nothing but digests leaves the check | Keys match `^[0-9a-f]+$` |
| A tax return reaches no pay history | The journey asserts zero rows, then one after overruling |

Mutation-tested: letting a tax return through silently fails 4 tests.

596 frontend tests, 235 backend tests, lint and build clean. The journey drives
a notice of assessment through the production container: the question appears,
nothing is added, and overruling it adds one payslip with empty figures.

## A bug this found

The mixed-names panel was rendered inside the alerts region, which only existed
when there was an error, a skipped file or an unknown layout. Two payslips that
both read perfectly and disagreed about whose they were would have produced
**nothing at all** — the one case the check exists for.

The unit test passed throughout; it tests the function, and the function was
right. Driving it in a browser is what found it.

## Still open

A **documented** layout states no employee name, so the name check only applies
to assisted readings. Two people's payslips in a layout this app documents are
still both accepted. Closing that means reading a name on the device, which is
a larger change and a different privacy argument.

The scenario catalogue's remaining items — no finding across a period nothing
covers, one employer under two names, a corrected payslip as a replacement, a
period unlike its neighbours — are not in this milestone.
