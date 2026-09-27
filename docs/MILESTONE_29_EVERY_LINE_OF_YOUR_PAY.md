# Milestone 29 — every line of your pay

Status: **built** for payslips. The contract half is not done; see *Still open*.

## The payslip that started it

A real one, brought to this project by the person building it. A fortnight of
shift work:

| Paid for | Hours | Rate | Amount |
|---|---|---|---|
| Ordinary | 8.00 | $45.2800 | $362.24 |
| Afternoon | 38.50 | $49.8080 | $1,917.61 |
| Saturday | 7.50 | $63.3920 | $475.44 |
| Sunday | 15.50 | $81.5040 | $1,263.31 |
| | **69.50** | | **$4,018.60** |

The reader took the first row. It checked **$362 of $4,019 — nine percent** —
and the ninety-one percent it skipped is the penalty loadings, which is where
pay in shift work most often goes wrong. The rate check then reported that the
recorded rate agreed with the payslip, which was true and close to worthless.

## The reasoning that was there, and what was wrong with it

Written into the parser:

> Only the ordinary line is read. An overtime or penalty multiplier depends on
> the award and the roster, neither of which Xoba Paycheck knows, so those lines are
> left to the gross total and never checked against an agreed rate.

That is right about the word **correct** and wrong about everything else.

| Question | Needs the award? |
|---|---|
| Does this line's hours × rate equal the amount printed beside it? | No |
| Do the lines add up to gross, and what doesn't? | No |
| What is this rate as a multiple of the ordinary rate? | No |
| Is ×1.4 the Saturday loading this person is entitled to? | **Yes** |

Only the last one was ever out of reach. The app now answers the first three
and stays silent on the fourth, in those words on the screen.

## Four decimal places, and why it is not a detail

The rates above are printed to four places, and the app's money parser accepts
two. It rejected every one of them. So did the token filter that decides which
figures sit under which column — a rate it cannot recognise as a figure leaves
its column reading empty, and the line becomes invisible.

Widening it is not tidiness. Rounding the rates to cents **breaks the
arithmetic on a payslip that is perfectly correct**:

```
38.5 × 49.808 = 1917.608 → $1,917.61   ← what the payslip says
38.5 × 49.81  = 1917.685 → $1,917.69   ← what rounding gives
```

On the fictional table below, rounding rates to cents makes **three of four
lines** stop agreeing with amounts that are right. A check that fires on a
correct payslip is worse than no check at all, so:

- rates and hours are held as **ten-thousandths**, as integers, and hours ×
  rate is done in whole cents with no float anywhere;
- the **earnings block** matches figures to four places; the totals table keeps
  the stricter two, because a gross printed to four places is a misread;
- a line is allowed **one cent** either way, because payroll systems disagree
  about rounding half a cent. Two cents is a difference, not slack.

The review form still holds two places. A line padded out to `28.7600` is
trimmed to `28.76` — **trailing zeros only**. A figure genuinely finer than two
places is left exactly as printed and flagged by the form, rather than quietly
rounded behind the person's back. Full precision is kept on the earnings line
either way, which is where the arithmetic happens.

## What the screen says now

On the *Check your figures* step, above the fields:

> **How this pay adds up**
>
> | Paid for | Hours | Rate | Amount | Compared with ordinary |
> |---|---|---|---|---|
> | Ordinary hours | 7.50 | $28.76 | $215.70 | this is the ordinary rate |
> | Afternoon hours | 36.25 | $31.6360 | $1,146.81 | 1.1 times it |
> | Saturday hours | 8.00 | $40.2640 | $322.11 | 1.4 times it |
> | Sunday hours | 14.00 | $51.7680 | $724.75 | 1.8 times it |
>
> Every line with hours and a rate matches what those two come to.
>
> These 4 lines come to $2,409.37, which is all of your pay before deductions.
>
> Only the ordinary line can be compared with a rate you have recorded, and it
> is **9%** of this pay. The other 3 lines are multiples of your ordinary rate,
> shown above. Whether those are the multiples you are entitled to depends on
> your award or agreement, which Xoba Paycheck has not seen.

That last paragraph is the milestone. The app may not say a rate "checks out"
without saying how little of the pay that covered.

When a line does not follow from its own hours and rate it is named exactly,
and as a fact about the document rather than a conclusion about anybody:

> **One line does not match its own hours and rate.**
> Ordinary hours: 38.00 hours at $28.90 comes to $1,098.20, but this payslip
> says $1,080.00.
>
> Check those figures against your payslip. A difference here is on the
> document itself, not something Xoba Paycheck worked out about your entitlements.

An allowance paid outside the hours table is reported as unitemised, not as an
error, because that is what it is.

## What is checked

| Invariant | How |
|---|---|
| Every row of the block is read | A fourth fictional v3 advice with four lines; labels, hours, rates and amounts all asserted |
| The block stops at the totals table | It ends at its own total, the next header, or a `Description` row, so gross is never counted twice |
| The ordinary fields stay the ordinary line | The advice carrying an overtime line still puts none of it in the form — and the line is now proved to be read elsewhere |
| Four places are load-bearing | A test rounds the rates to cents and asserts three of four lines then disagree |
| One cent of slack, and no more | 724.76 passes, 724.77 is a difference |
| A line with no rate is unchecked, not wrong | A bonus row reports `null`, not `false` |
| Nothing is claimed about entitlement | The multiplier is described ("1.4 times it"), never judged |

Both core invariants were mutation-tested. Widening the tolerance from one cent
to a dollar fails 3 tests; putting the figure pattern back to two decimals fails
4, including the end-to-end read of the shift-work advice.

522 frontend tests, lint and build clean. Driven in a real browser against the
running app: the table renders, the figures are right, the discrepancy in the
existing third advice is found and named, and **no request leaves the device**.

## The contract half

The case this came from is a contract that states Saturday, Sunday and
public-holiday rates, and an app that recorded one number. The contract reader
now returns those terms beside the rate:

```json
{ "kind": "saturday", "multiplier": "1.5", "amount": "",
  "quote": "Work performed on a Saturday is paid at time and a half." }
```

A contract says it one of two ways — *"time and a half"* or *"$58.50 an hour"* —
so exactly one of multiplier and amount carries a figure; both, or neither, and
the entry is dropped. The kinds are a closed enum in the schema, so a day this
app has no rule for cannot come back at all.

**A casual loading is deliberately not one of them.** It applies to every
ordinary hour rather than to a kind of day, so it changes what the ordinary
rate *is* rather than sitting on top of it. The existing rule refusing a loaded
rate still covers it, unchanged.

**Verification is the rate's defence applied harder.** Every penalty carries its
own sentence, every sentence must be in the contract, and one that is not
**discards all of them** — an answer that will supply a sentence the contract
does not contain has not earned belief about the others. A reading whose own
rate sentence could not be found is not believed about penalties either.

Why that strictness: a wrong ordinary rate gives one baseline nobody may act
on. A wrong penalty gives a specific claim about a specific Saturday, about a
term that may never have been in the contract.

### What it says

> **1 question to ask**
>
> **The Saturday rate on this payslip is not the rate your contract states**
> Kingfisher Example Care · 2026-07-01 to 2026-07-14
>
> **YOUR RECORD** Your contract states 1.5 times your ordinary rate, which comes
> to $43.14 an hour: *"Work performed on a Saturday is paid at time and a half."*
> **THIS PAYSLIP** The "Saturday hours" line was paid at $40.2640 an hour.
> **THE DIFFERENCE** $2.88 an hour below the rate that sentence states. Over the
> 8.00 hours on that line, that is $23.01.
>
> Xoba Paycheck compares one line on this payslip with one sentence in your document.
> It does not know your award or agreement, whether a different term covers this
> shift, or how those hours were classified.

The gap is given in cents and then multiplied out. Four decimal places in a
money figure reads as noise, and a few cents an hour means nothing to anybody
until it is a number over hours actually worked. The rate itself is printed as
the payslip prints it, because that is the document's own figure.

### What it will not conclude

| Situation | What happens |
|---|---|
| Penalty line, no matching contract term | Nothing. Never "fine" |
| Contract term, no matching payslip line | Nothing. **Never "unpaid"** |
| A multiplier with no recorded ordinary rate | Nothing. Never a guessed base |
| A line whose rate equals the term | Nothing |

The second row is the one that matters. A fortnight with no Sunday shift owes
no Sunday penalty, and raising it would be an accusation built out of an empty
roster.

Which day a line is for is read from its label, and the patterns are **ordered**,
because a label can carry two of the words. *"Saturday overtime"* is overtime,
and a contract's Saturday rate is not the rate for it. Reordering the patterns
fails a test.

Verified in a browser end to end: a shift-work advice, a contract read with an
evening term at ×1.1 and a Saturday term at ×1.5. The afternoon line matches
×1.1 exactly and raises nothing; the Saturday line is $2.88 an hour below and
raises one question. No page errors.

The banned-word test covers this finding's every string, including the message
the person can send, which asks and never asserts an entitlement.

## Still open

**The assisted reader** returns the twelve fields and no table, so a payslip
read that way shows no lines and no penalty comparison. The documented layouts
are unaffected.

**The assisted reader** returns the twelve fields and no table, so a payslip
read that way shows no lines. The documented layouts are unaffected.

**No figure from anybody's own payslip is in this repository.** The fixture is
fictional, with the same shape: a base rate with cents in it, loadings at exact
multiples, and amounts that only come out right at four decimal places.
