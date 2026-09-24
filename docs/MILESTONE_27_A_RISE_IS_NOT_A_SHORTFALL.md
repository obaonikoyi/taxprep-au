# Milestone 27 — a pay rise is not a shortfall

Status: **built.** No configuration, no key, on for everyone.

## The case this was not designed for

A contract runs for two years. Pay does not. In Australia most awards and the
national minimum wage are reviewed every year, and plenty of employers raise a
rate without reissuing paper. So the ordinary thing that happens is:

> I recorded $30.00 an hour from my contract in 2024.
> My payslip from last fortnight says $32.10.

Nothing is wrong. The record is simply out of date.

Until now the panel treated that identically to being paid **less**: the same
heading, the same count of "questions to ask", the same limit text, and the same
button offering **a message to send payroll**.

Nobody writes to payroll to ask why they were paid more. A panel that suggests
it is a panel that cries wolf, and one that cries wolf about a pay rise is worse
than one that says nothing — because the next time it raises a real shortfall,
it has already taught the person to ignore it.

## What it does now

A payslip **above** the recorded rate is a separate kind of finding, in a
separate list, headed *"Your record looks out of date"* and introduced with
*"These are not questions for your employer."*

| | Below the record | Above the record |
|---|---|---|
| Heading | The rate on this payslip is not the rate you recorded | This payslip pays more than the rate you recorded |
| Counted in | "N questions to ask" | "Your record looks out of date" |
| Message to payroll | Yes | **None** |
| What to do | Ask, and keep the payslip | **Record the new rate from this period** |

The button does the whole thing: it ends the old record the day before this pay
period starts, opens a new one from the period's first day at the payslip's
rate, and notes where the figure came from. Earlier payslips keep being
compared with the rate that covered them at the time, which is the entire point
of a rate having a date.

## What it still says

An increase is almost always a rise. It is not always:

> This is almost always a pay rise your record has not caught up with — awards
> and agreements are commonly reviewed each year. Xoba Paycheck cannot tell a
> rise from a one-off overpayment, and an employer who has overpaid by mistake
> may ask for it back, so it is worth knowing which this is.

Said once, in the finding, without alarm. Somebody who knows which of the two it
is has lost nothing by being told, and somebody who does not has been handed the
only question worth asking.

## Deliberately unchanged

- **The app still does not know your award.** It compares a payslip with *your
  own record* and nothing else. A rise being "the annual increase" is a guess it
  is not entitled to make, so the wording says awards are commonly reviewed
  rather than claiming this rise is one.
- **A payslip that states no rate** gets the same treatment on the amount
  instead, but no one-click update — there is no rate printed to record.
- **The self-check is untouched.** A payslip that does not agree with its own
  hours and rate is still a question whichever way it leans, because that is an
  arithmetic fault on the document rather than a record that has aged.

## Verification

- 8 tests over exactly the two scenarios a person brings: a two-year-old
  contract with a recent higher payslip, and the same contract with an early
  payslip that should match it exactly — the second finding **nothing at all**,
  which is the right answer and easy to get wrong.
- A run containing both a shortfall and a rise separates them.
- **Mutation-checked:** treating a rise as a question again fails five of them.
- The payslip journey, in a real browser: a rise appears under its own heading,
  **offers no message to payroll**, does not appear in the questions list, and
  one click records the new rate — leaving two records, the old one ended.
