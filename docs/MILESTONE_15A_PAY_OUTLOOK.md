# Milestone 15A — pay outlook and earnings scenarios

Status: published for [issue #43](https://github.com/obaonikoyi/taxprep-au/issues/43). This is the first bounded part of Milestone 15. It does **not** add a personalised tax calculation.

## User outcome

After checking payslips, a user can choose one financial year and one employer and explore what regular future pay could look like through 30 June.

The outlook keeps recorded facts separate from assumptions:

- recorded gross and withholding come only from checked payslips;
- the user explicitly enters the next payday and pay frequency;
- the latest checked gross and withholding are offered as editable regular-pay inputs;
- the user confirms that the future pattern is regular rather than a bonus, back pay or adjustment;
- future pay dates are generated only through the selected financial year's 30 June;
- three gross scenarios are shown: entered pay, 20% less and 20% more.

## Withholding and tax boundary

Only the unchanged entered-pay scenario carries forward the entered withholding amount. The ±20% gross scenarios deliberately show future withholding as **Not estimated**.

This milestone does not:

- scale withholding when gross pay changes;
- calculate final tax;
- estimate a refund or amount payable;
- validate an employer's payroll withholding schedule;
- treat one employer as whole-person income; or
- unlock the separate tax-position calculation.

Qualified source and rounding review remains open in #28. Tax profiles and reviewed withholding/tax logic remain Milestone 15B.

## Scope and completeness

An outlook requires one employer and one financial year. If a payslip in that scope is unconfirmed or has a validation/duplicate issue, calculation is blocked rather than silently excluding it.

The user may mark the recorded history as complete for that employer and year so far. If they do not, the result is visibly labelled **Partial recorded history**. Even when marked complete, the UI and export state that this covers one employer only and is not whole-person income.

Changing records, employer, financial year or any outlook input clears the previous result and its assumptions.

## Calendar arithmetic

Supported regular schedules:

- weekly;
- fortnightly;
- every four weeks; and
- monthly.

Weekly schedules add 7 calendar days, fortnightly 14 and four-weekly 28.

Monthly schedules preserve the original payday's day-of-month anchor where possible. For example, a 31 January next payday becomes 28 February in a non-leap year, then returns to 31 March rather than drifting permanently to the 28th.

All schedules stop at 30 June. No missing historical pays are manufactured and no cumulative YTD fields are annualised.

Arithmetic version: `pay-outlook-arithmetic-v1`.

## Export

The offline HTML outlook report includes:

- employer and financial year;
- history-completeness status;
- arithmetic version;
- recorded payslip count, gross and withholding;
- next payday, frequency, normal gross and normal withholding inputs;
- every assumed future pay date;
- all three gross scenarios;
- source file/manual-entry references and hashes where available; and
- explicit statements that the result is not final tax, a refund estimate or whole-person income.

Raw PDFs are not embedded.

## Verification

Automated coverage includes:

- financial-year boundaries;
- weekly and four-weekly stopping at 30 June;
- monthly 31st-day anchoring;
- changed-gross scenarios with no invented withholding;
- next-payday and regular-pattern validation;
- report escaping, source references and partial-history labels;
- guided dashboard integration;
- browser export;
- desktop/mobile screenshots and overflow checks; and
- existing request monitoring to confirm no document upload or model call is introduced.

Feature [PR #44](https://github.com/obaonikoyi/taxprep-au/pull/44) merged as `3fbbe515e29132f5dcc5d713499f312f10b6e056`. Final feature CI run `35421668220` passed frontend lint/tests/build, backend/API plus browser smoke, and the production-container browser journey.

Railway production deployment `cd1067bf-d7ef-4e97-a48f-0f34b6de1d96` serves that exact merge commit at the existing standalone URL. The publication PR updates `deployment.json` and must pass **Verify hosted demo** against the public Railway deployment before merge; final hosted evidence is recorded in issue #43. The portfolio website remains unchanged.
