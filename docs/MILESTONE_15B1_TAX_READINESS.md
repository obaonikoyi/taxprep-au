# Milestone 15B-1 — tax-profile readiness without a tax estimate

Status: published for [issue #46](https://github.com/obaonikoyi/taxprep-au/issues/46), as the safe first part of [Milestone 15](https://github.com/obaonikoyi/taxprep-au/issues/36).

Milestone 15A can project explicit one-employer gross-pay scenarios. 15B-1 changes scope deliberately: tax readiness is a **whole-person, one-financial-year** check. It collects facts that a later reviewed calculation would need, while keeping every refund, debt and final-tax result locked.

## Why there is no tax number

The existing bounded 2025–26 tax-position prototype in [issue #28](https://github.com/obaonikoyi/taxprep-au/issues/28) still has an open qualified-review criterion for sources, boundary examples and filing/settlement rounding. TaxPrep must not turn a profile questionnaire into apparent approval.

This increment therefore has a permanent engineering gate:

- profile answers can be reviewed;
- missing and unsupported circumstances can be explained;
- an offline readiness report can be exported; but
- the tax-result flag is always locked.

Recorded PAYG withholding remains a recorded amount taken during the year. It is never described as final tax or a refund by itself.

## Whole-year pay coverage

The readiness section appears after the payslip summary and pay outlook.

The user must choose one financial year. Unlike the employer-specific pay outlook, readiness intentionally uses **all checked employers in that financial year**, even if the pay chart is filtered to a single employer.

Coverage shows:

- checked pay-record count;
- distinct employer count; and
- employer names.

These numbers are context only. They do not prove that taxable income is complete.

If an unconfirmed or unresolved payslip belongs to the selected financial year, readiness is blocked. A record with an invalid/unknown payday is also treated conservatively as potentially belonging to that year and blocks the check instead of being silently omitted.

## Profile questions

Every question starts unknown. Each uses **Yes / No / Unsure** and no answer is inferred from payslip text.

The initial profile asks whether:

1. the user was an Australian resident for tax purposes for the full financial year and was not using working-holiday/another special rate;
2. every employer and salary/wage record for the year has been captured;
3. there was other income outside salary/wages or sole-owner Australian bank interest;
4. a study or training support loan applied;
5. the tax-free-threshold and withholding-declaration choices at each employer are known;
6. the user was single with no spouse or dependants for the full year;
7. a Medicare levy exemption/reduction or Medicare levy variation circumstance applied;
8. private patient hospital cover or another MLS/private-health circumstance needs consideration;
9. deductions, offsets or other annual adjustments need to change the calculation; and
10. bonuses, commissions, back pay, termination payments or other irregular employment payments occurred.

TaxPrep never asks for the user's TFN in this profile.

## Readiness classification

The deterministic classifier separates answers into three groups:

- **Answered within current profile** — the explicit answer matches the current narrow prototype.
- **Needs information** — the answer is missing/unsure, or the user says their pay coverage/declaration choices are not yet known.
- **Outside current supported profile** — the user has explicitly described a circumstance the narrow prototype does not support.

A profile with all ten supported answers shows **Profile facts collected**, but the tax result remains locked because rule review is a separate gate.

Changing the financial year or any pay record resets the in-memory profile and previous readiness result.

## ATO terminology references

Version: `ato-profile-terminology.2026-09-19`.

The following current ATO materials inform question wording only:

- [Tax file number declaration](https://www.ato.gov.au/TFNdec)
- [Tax withheld calculator and declaration inputs](https://www.ato.gov.au/calculators-and-tools/tax-withheld-calculator)
- [2026 PAYG withholding schedules](https://softwaredevelopers.ato.gov.au/PAYGWTaxtables)
- [Study and training loan repayment information](https://www.ato.gov.au/api/public/content/0-541493af-7e73-48ae-aeac-89705f225c09)

They are **not** active calculation bindings in this milestone. No withholding schedule or annual-tax formula is applied. Their presence does not satisfy the professional review still open in #28.

Readiness version: `tax-readiness-profile-v1`.

## Offline report

The readiness HTML report contains:

- selected financial year;
- checked pay-record and employer coverage;
- every profile answer;
- readiness classification;
- source file/manual-entry references and hashes for checked payslips;
- terminology reference links/version; and
- the pending-review / no-tax-result warning.

Raw PDFs are not embedded.

## Privacy and architecture

The feature is frontend-only and session-only.

- No account.
- No browser persistence.
- No backend tax request.
- No payslip/document upload.
- No model request.
- No TFN field.
- Refresh, workspace change, financial-year change or pay-history change clears the profile.

## Verification target

Automated coverage includes:

- all-supported, unknown and explicit-outside profile classification;
- whole-year coverage across multiple employers;
- unresolved/unknown-date pay blocking;
- escaped source-linked report output;
- guided React integration;
- browser journey with a specific employer filter while readiness still uses all employers;
- answer invalidation after change;
- offline readiness export;
- desktop/mobile screenshots and overflow checks; and
- existing request monitoring for no document upload/model request.

Feature [PR #47](https://github.com/obaonikoyi/taxprep-au/pull/47) merged as `26bc12f9d12793d4d7edbfe9f173cc787788d37f`. Feature CI run `35422385886` passed frontend lint/tests/build, backend/API plus browser smoke, and the production-container browser journey.

Railway feature deployment `50f28ea3-a868-45ae-aba6-ad2d4132808c` succeeded for that exact merge commit at the existing standalone URL. The publication PR records the deployment and must pass the dedicated public hosted-browser workflow before merge. Final hosted evidence is recorded in issue #46. The portfolio website remains unchanged.
