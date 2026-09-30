# Milestone 30 — the earnings table on a layout nobody documented

Status: **built.** Off unless an Anthropic key is configured, and off unless the
person answers the question asked about their own file.

## How it was found

[Milestone 29](MILESTONE_29_EVERY_LINE_OF_YOUR_PAY.md) was built because a real
payslip had four earnings lines and the app read one. It shipped, and then the
same person put the same payslip through the live app — and the table did not
appear.

It had been written down as *"still open: the assisted reader returns the twelve
fields and no table"*, which made it sound like an edge case. It was not an edge
case. It was **his** case, and everybody else's whose employer prints a layout
this app does not document. Milestone 29 worked on a fixture and could not reach
the document that motivated it.

Two independent reasons:

1. A layout nothing here documents goes to the assisted reader, and that path
   carried no table at all.
2. The on-device detector needs one row containing *hours*, *rate* and *this
   pay*. His payslip prints the header across two rows **and has no hours
   column heading at all** — "Ordinary Hours" is the row's label, not a heading.

## Why a model may read this table

A payslip's earnings table is one of the few things a model can transcribe and
this app can still check, because **the table proves itself**:

- every figure in it must appear in the payslip's own text, and
- the amounts must add up to the gross printed beside them.

That is the same argument that made
[Milestone 26](MILESTONE_26_READING_AN_UNSUPPORTED_STATEMENT.md) defensible.
Nobody hand-checks thirty transcribed numbers, so the document does it.

### Two gates, in two places, for two different failures

| Gate | Where | Catches |
|---|---|---|
| Every figure is in the text | Server, which holds the text | An invented row; a misread rate |
| The rows add up to gross | Browser, which holds the arithmetic | A dropped row; a wrong amount |

Both are **all or nothing**. A model that produced one figure the payslip does
not contain has not earned belief about the rest, and half a table is worse than
none — the missing half would read as pay that was never itemised.

The second gate is the subtler one. **A dropped row and an unitemised allowance
look identical in a total.** On a documented layout the parser is deterministic,
so a shortfall really is an allowance and is reported as one. Here it could be a
row nobody read, so the only safe reading of a table that does not add up is no
table. A cent a row of slack, because payroll systems disagree about rounding
half a cent and a table carries that difference a row at a time.

The prompt says so in as many words — *"YOUR TABLE IS CHECKED… guessing a row
cannot be hidden, and an omitted row is safer than an invented one"* — for the
same reason the statement reader's does: a transcriber told its work is checked
has no use for a guess.

## What it does now

A payslip in a layout nobody documented, read after the person said yes, now
shows the same table Milestone 29 shows for a documented one:

> **How this pay adds up**
>
> | Paid for | Hours | Rate | Amount | Compared with ordinary |
> |---|---|---|---|---|
> | Ordinary Hours | 8.00 | $45.28 | $362.24 | this is the ordinary rate |
> | Afternoon Hours | 38.50 | $49.8080 | $1,917.61 | 1.1 times it |
> | Saturday Hours | 7.50 | $63.3920 | $475.44 | 1.4 times it |
> | Sunday Hours | 15.50 | $81.5040 | $1,263.31 | 1.8 times it |
>
> Every line with hours and a rate matches what those two come to.
> These 4 lines come to $4,018.60, which is all of your pay before deductions.
> Only the ordinary line can be compared with a rate you have recorded, and it
> is **9%** of this pay.

Drop one row from that answer and the screen shows **no table at all**. Both
verified in a real browser against the running app.

A row with an amount and no hours — a bonus, an allowance, a leave payment — is
kept and simply not checked by the arithmetic. It is a row nothing can verify,
which is not the same as a row that is wrong.

## Deliberately not done

**The on-device detector was left alone.** Loosening it to find a header split
across two rows would not have helped: that payslip labels no hours column, so
the column would have to be found by position. Guessing which column is which is
exactly what this app refuses to do everywhere else — it is how a year-to-date
figure becomes a fortnight's pay. An undocumented layout goes to the reader,
where the answer can be checked; it does not get a parser that hopes.

## What is checked

| Invariant | How |
|---|---|
| A figure not in the payslip discards the table | A Saturday row that document never printed |
| A rate rounded to cents discards it too | `49.81` for `49.8080`, which would then fail its own arithmetic and read as a fault on the payslip |
| A dropped row discards it | The four-row table minus one, in a browser |
| An invented row discards it | A fifth row that balances nothing |
| A cent a row is slack; more is not | `1263.32` passes, `1263.36` does not |
| No gross means no table | Rather than a table nothing checked |
| A bonus row survives | Amount only, unchecked, not dropped |
| Shape is narrowed at both ends | Server and browser, because either could change alone |

Mutation-tested. Removing the arithmetic gate fails 3 frontend tests; removing
the figures-in-document check fails 2 backend tests.

585 frontend tests, 213 backend tests, lint and build clean.

## Still open

The **contract** side needs a rate record to compare against, so the penalty
comparison from Milestone 29 only fires once a contract has been read or a rate
typed in. Reading the table is what makes that possible for an undocumented
layout; it is not the same thing as having done it.
