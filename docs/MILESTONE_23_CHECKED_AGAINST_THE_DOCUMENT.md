# Milestone 23 — checking a reading against the document

Status: **built.** Always on, nothing to configure.

## Why

Every reading in this app is a proposal the person confirms, and until now the
person was the only thing standing between a wrong figure and a total. That is
a lot to ask of someone looking at twelve fields, and it asked most where it
should have asked least.

A documented parser takes its figures **out of the text**, so its numbers are in
the document by construction. A payslip read by asking a model is only as good
as the model: it can return a figure that is nowhere on the payslip, and it can
calculate one — which [the prompt tells it not to do](MILESTONE_19_ASSISTED_PAYSLIP_READER.md)
and cannot stop it from doing.

## What it does

Every figure a reading proposed is looked for in the text that was read. A
figure that is not there is named, on the review screen, beside the field:

> **One figure was not found in what we read.**
> super recorded does not appear in the text below. That does not make it
> wrong — a payslip can print a figure in a way this check cannot match — but
> check it against your payslip before you confirm.

The text to compare against is opened for you rather than left folded away.

**It never refuses.** A reading can be right in a way this check cannot see: a
payslip printing `1 840,00`, a figure split across a line break, a total the
payslip states only in words. Blocking on that would be wrong and infuriating.
What the check is for is turning *check twelve fields* into *check this one*.

## What is deliberately not checked

| Not checked | Why |
|---|---|
| Dates | Turning "16 Jul 2026" into `2026-07-16` is the reading doing its job |
| Employer name | It wraps, abbreviates and is printed in pieces |
| Any figure of zero | A payslip with no deductions prints nothing at all, and `0.00` is the correct reading of nothing |
| A figure the person has edited | Once they have typed their own value, this has nothing left to say about it |

Punctuation is not a difference: `1840.00`, `1,840.00` and `$1,840` are the
same figure, and all three match.

## Verification

- 8 tests over the rule itself, including that it says nothing when every
  figure is present, names one that is nowhere in the document, matches across
  punctuation, never questions a zero, leaves dates and the employer alone,
  stops asking once the person edits the field, and says nothing at all about a
  payslip typed in by hand.
- **The journey proves both directions in a real browser.** The assisted reader
  is now exercised twice against the same fictional payslip: once with a
  reading that matches it, where nothing is questioned, and once with a reading
  that proposes a superannuation figure the payslip never stated, where that
  figure is named, the gross pay beside it is *not*, the text is already open
  for comparison, and **the person can still confirm** — because this names, it
  does not refuse.
- The journey's privacy assertion was tightened rather than loosened to allow
  the second read: it counts the requests exactly, so a third appearing from
  anywhere still fails it.

## Not done

- **It cannot see a figure that is present but wrong.** A model that reads the
  year-to-date column returns a figure that is genuinely in the document, and
  this check passes it. The rule against that is in the prompt, and the person
  is still the control.
- **A figure printed in words** ("one thousand eight hundred and forty") is not
  matched, and would be named as missing.
- **Nothing is checked against the picture** for a photographed payslip — the
  recognised text is what was read, so a figure is in it by construction, the
  same way a documented parser's is. What a misreading breaks is arithmetic,
  and that is caught by the confirmation checks.
