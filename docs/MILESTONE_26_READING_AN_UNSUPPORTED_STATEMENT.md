# Milestone 26 — reading a bank statement nobody documented

Status: **built.** Off unless a key is configured, and off for every person who
does not tick the box on that one file.

## Read this part before the feature list

**This is the most sensitive document the app touches, and it is not close.** A
payslip says who employs you and what you earn. A contract says what you agreed
to. A bank statement says where you shop, what you subscribe to, who you pay,
when you were short of money and what you were short of it for — a period of it,
line by line.

The statements screen has said, in plain words on the screen, that **no AI model
is used**. That sentence is now conditional: it still reads that way for
everybody who does not deliberately turn this on, and for anyone who does, that
paragraph says instead that they asked for a transcription and what was checked.

If that trade is not worth making, this is the milestone to remove. Everything
below is the case that it is.

## Why it is defensible here and would not be elsewhere

**A statement carries its own checksum.** It prints an opening balance, a
closing balance, and its debit and credit totals, and the transactions between
them must come to exactly that.

So a statement read by a model is **not a proposal to eyeball**. That matters,
because the honest thing to admit about a payslip's twelve fields is that a
person checks them; nobody is going to check two hundred transactions by hand,
and a screen that asks them to is a screen that gets clicked past.

It is arithmetic instead. Three independent checks, all of which must pass:

| Check | Catches |
|---|---|
| Opening + every amount == closing | A dropped transaction, an invented one, a wrong amount |
| Money out == printed debits, money in == printed credits | Two errors that cancel out in the closing balance |
| Every printed running balance == the row before it plus this amount | A pair of amounts swapped between rows, which the totals cannot see |

**Any one of them failing throws the whole transcription away.** Nothing partial
is imported, the statement already open is untouched, and the person is sent to
their bank's CSV export, which needs nothing sent anywhere and always works.

A statement that prints no opening and closing balance is refused outright, on
the same reasoning: without a checksum there is no reason to believe any of it.

## What the checks cannot do

They are arithmetic, so they see amounts. **They cannot tell whether a
description was copied correctly** — a misread merchant name adds up exactly as
well as a right one. That is said on the screen and in the downloaded report,
in those words, rather than left for someone to infer from the word
"reconciled".

The prompt is written accordingly: it is told it is a transcriber and not an
analyst, told never to tidy, expand, translate, categorise or summarise a
description, and told that its work is checked against the statement's own
arithmetic so guessing cannot be hidden.

## What leaves the device

Only the text the browser already extracted, to this origin. The PDF is not
uploaded. Nothing is stored: no file, no log of the text, no record of the
request. The statements journey asserts that the assisted reads are **the only**
non-GET requests in the entire run, counted exactly, so a third from anywhere
fails it.

The choice sits **above** the file picker, and it says what is sent in the words
that matter: *every transaction description, so every merchant you paid.*

## Cost

A statement is the most expensive thing this app reads — pages of text in,
hundreds of rows out — so it **counts as ten reads** against
[the same budget](MILESTONE_20_READ_LIMITS.md). At the default 150 a day that is
15 statements, and the number is charged honestly rather than flattered.

## Verification

- **The whole path in a real browser** against a local container serving the
  real build: a PDF the documented parser refuses is transcribed, reconciles,
  and imports with the right totals; the screen says a model read it and no
  longer claims otherwise.
- **The half that matters more, in the same journey:** a transcription missing
  one transaction is refused outright, and the statement already imported is
  untouched.
- 20 browser-side tests over the checksum, including a lost transaction, an
  invented one, a transposed amount, **two errors that cancel out** (caught by
  the printed totals) and **two amounts swapped between rows** (caught only by
  the running balances) — which is why all three checks are kept.
- 13 backend tests over the answer boundary, including that account numbers and
  anything else unasked-for are dropped.
- **Mutation-checked:** removing the closing-balance check lets a transcription
  with a missing transaction through, and a test fails.

## Not done, deliberately

- **Nothing checks a description against the statement.** The arithmetic cannot,
  and there is no equivalent of [the contract quote check](MILESTONE_25_READING_THE_CONTRACT.md)
  for two hundred free-text lines. This is the real remaining hole and it is
  stated rather than papered over.
- **A scanned statement is still not read.** Only text the browser could already
  extract is sent. Recognising sixty pages of columns is a different problem
  from recognising one payslip.
- **400 transactions.** Beyond that the person is asked for a shorter period or
  the CSV export.
- **The documented parser is always preferred** and is not going away. It reads
  its layout with column coordinates and can be held to its own arithmetic; this
  can only be held to the statement's.
