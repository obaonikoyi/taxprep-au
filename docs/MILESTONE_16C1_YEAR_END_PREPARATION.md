# Milestone 16C-1 — unified year-end preparation hub

Status: implementation in progress for [issue #54](https://github.com/obaonikoyi/taxprep-au/issues/54), as the first engineering slice under [#37](https://github.com/obaonikoyi/taxprep-au/issues/37).

## User outcome

Keep the published employment-source reconciliation as the income source of truth, then record optional bank-deposit checks and expense/evidence coverage in one session-only preparation handover.

## What this milestone adds

- Per-employer comparison of checked payslip net pay with a user-entered bank deposit total.
- Explicit bank states: matched, split/timing difference, possible missing deposit, not checked and unsure.
- Deposit differences remain review questions. Bank deposits never replace gross income, withholding or annual-source figures.
- Expense/evidence coverage answers for bank-spending review, receipt/evidence review, work-purpose answers and supported-rule review.
- Optional counts copied from the Bank spending / Tax documents workflows: reviewed transactions, work-review transactions, receipt/evidence items and work-purpose answers.
- Optional amount flagged for work review, explicitly labelled as not an approved deduction.
- One combined HTML handover containing reconciled employment sources, source references, bank-check notes, expense/evidence coverage and all open questions.
- 390px mobile layout and real Chromium verification.

## No double counting

Payslips and annual income statements remain two views of the same employment income. The 16C preparation hub reuses the existing reconciliation result rather than creating a second income total.

Bank-deposit totals are compared only with checked payslip net pay. They are never used to infer gross income, tax withheld or taxable income.

## Expense/evidence boundary

Expense coverage is preparation metadata only. A user-entered amount flagged for work review is not a deduction and does not flow into any tax result.

Qualified rule review remains separate in #21 and #28.

## Session-only design

This milestone adds no persistence, account, cloud save or document vault. Switching/refresh behavior remains consistent with the existing local-only workflows.

Future save/resume work is blocked on [the explicit storage/retention design](YEAR_END_SAVE_RESUME_DESIGN.md).

## Verification target

- Pure tests prove bank checks cannot mutate employment reconciliation.
- Split/timing and missing-deposit states remain questions.
- A mismatching deposit total cannot be labelled as a clean match.
- Invalid counts remain unresolved.
- Export escapes hostile notes and retains source references.
- React test covers the session-only bank/expense interaction flow.
- Chromium covers reconciliation → bank checks → expense/evidence coverage → combined export → 390px mobile.
- Existing no-upload/no-model-request monitoring remains in force.

Feature CI, Railway publication and hosted-browser evidence will be recorded here after the PR passes.