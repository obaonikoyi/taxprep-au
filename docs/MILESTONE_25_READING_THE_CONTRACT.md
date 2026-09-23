# Milestone 25 — reading the agreed rate out of the contract

Status: **built.** Off unless a key is configured, like every other reading
this app asks a model for.

## This was deliberately refused, and here is what changed

[Milestone 19](MILESTONE_19_ASSISTED_PAYSLIP_READER.md) ended with:

> **Contracts are still not read by a model.** That waits on the same operating
> model work it always has: a contract carries a salary, a signature and third
> parties, and it is a different decision from a payslip's figures.

Every one of those reasons is still true. What changed is that the thing that
made it dangerous can now be checked, so it is built around the reasons rather
than past them. **If you are deciding whether to keep this, the argument below
is the part to read, not the feature list.**

## Why a contract is not a payslip

**A wrong figure here is worse than a wrong figure there.** A payslip's gross
pay is one row in a total the person checks. A contract's rate becomes the
*baseline every payslip is compared against*, so one wrong number produces a run
of confident, specific, wrong findings — and this app exists to turn those into
a message somebody sends their employer. Being wrong here costs the person
their credibility with the person who pays them.

**A contract rate is frequently not a number.** *"$25.00 per hour plus a 25%
casual loading."* *"The rate for your classification under the award."*
*"Reviewed annually."* A single figure pulled out of any of those is not the
agreed rate and would disagree with every payslip the person owns.

**A contract names other people.** A manager, a signatory, an entity. Only the
text is sent, as with a payslip, and nothing is stored: no file, no log of the
text, no record of the request. What the app keeps afterwards is what it always
kept — a rate and the person's own note — **never the document**.

## The defence the payslip reader does not need

The model must **quote the sentence it read the rate from**, and the server
checks that sentence against the contract before the answer is believed. A rate
whose quote is absent, too short, or paraphrased is thrown away in full — rate,
basis, effective date and all — and replaced with a reason the person reads.

That turns "invent a plausible rate" into "invent a plausible rate *and* a
sentence that happens to be in this document", which a schema-constrained answer
copied out of the text does not do by accident.

Only one thing is forgiven: whitespace, because a PDF breaks a line where the
page ends rather than where the sentence does. **A paraphrase does not match**,
and a paraphrase is exactly what a rate that was inferred rather than read looks
like.

## Refusing is the main thing the prompt does

Most of the system prompt is about when to return nothing. It is told to refuse,
not resolve, when the document states:

- a base rate **plus** a loading, allowance or penalty — *"$25.00 per hour plus
  25% casual loading" is NOT a rate of 25.00 and is NOT a rate of 31.25*;
- a rate that depends on a classification, level, award or agreement the
  document does not itself put a figure to;
- more than one ordinary rate, for different periods or roles;
- a range, a minimum, an estimate, or "up to";
- a total package or superannuation-inclusive figure rather than an ordinary
  rate;
- anything it is not certain about.

The reason given to the model is the true one: *an empty amount costs the person
one minute of typing; a confident wrong one is compared against every payslip
they own.*

## What the person sees

The rate lands **in the form, not in their records.** The sentence it was read
from is shown underneath it:

> **Read from this sentence in your contract:**
> *"4.1  The ordinary hourly rate is $32.50 per hour, effective 1 July 2026."*
> Check it says what the figures below say. If it does not, change them —
> nothing is saved until you press save.

Change any of the figures and **the sentence stops being shown**, because it no
longer describes what is in the form.

A refusal says why, and leaves the form exactly as it was.

## Cost

A contract is several pages where a payslip is one, so it **counts as three
reads** against [the same budget](MILESTONE_20_READ_LIMITS.md). Charging it as
one would make that budget a number that no longer means what it says.

## Verification

- **The whole path in a real browser, against a local container serving the real
  build,** using the fictional contract from the user-test kit: only the text is
  sent (818 characters, no PDF), the rate, effective date, employer and source
  reach the form, the sentence is shown, **nothing is saved**, and changing the
  rate retracts the sentence.
- The same journey proves the refusal path: a contract whose rate carries a
  casual loading comes back with a reason, and **the form is left untouched**.
- The journey's privacy assertion counts requests exactly, and now expects four
  across the whole run — two payslip readings and two contract readings. A fifth
  from anywhere still fails it.
- 20 backend tests over the answer boundary and the quote check, 16 in the
  browser over what the app will believe.
- **Mutation-checked:** believing a rate without checking its quote fails three
  tests, including the one for a rate that is nowhere in the document.

## What this does not do, and should not be read as doing

- **It does not tell anyone what they should be paid.** It reports what one
  document says, so the app can compare payslips against *the person's own
  record*. Awards, classifications and minimum wages are still out of scope and
  still behind [#21](https://github.com/obaonikoyi/taxprep-au/issues/21) and
  [#28](https://github.com/obaonikoyi/taxprep-au/issues/28).
- **A rate that is in the contract can still be the wrong rate to use.** A
  contract superseded by a letter, a rate that changed in a review, a document
  that is not the current one — none of that is visible from the text, and the
  person is the only one who knows.
- **Nothing checks the quote is the *relevant* sentence.** A contract with a
  rate in clause 4.1 and a superseding rate in an annexure could be read from
  either. The prompt is told to refuse when there is more than one; nothing
  enforces it.
- **The contract is still never stored**, and this milestone does not change
  what a downloaded report contains.
