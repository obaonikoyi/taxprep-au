# Milestone 16A — annual employment-source reconciliation

Status: published for [issue #49](https://github.com/obaonikoyi/taxprep-au/issues/49), the first safe slice of [Milestone 16](https://github.com/obaonikoyi/taxprep-au/issues/37).

## User outcome

After checking payslips, a user can choose one financial year and compare the recorded pay-period history with annual employment sources such as final income statements or payment summaries.

The central rule is simple:

**Payslips and final annual employment sources are two views of the same employment income. Xoba Paycheck compares them; it never adds both together as extra income.**

This milestone does not unlock final tax, a refund or a debt calculation.

## Annual-source entry

Milestone 16A starts with manual entry. Document extraction remains deferred in [issue #30](https://github.com/obaonikoyi/taxprep-au/issues/30).

Each source records:

- employer or payer name;
- a user-readable source reference;
- source type: income statement or payment summary;
- gross income;
- tax withheld;
- final status: Tax ready/finalised, not final or unsure; and
- an optional link to one employer already represented in checked pay history.

Xoba Paycheck does not ask for a TFN. Source-reference help explicitly tells users not to enter one.

Up to 30 annual employment sources can be entered in one in-memory session.

## Final and provisional sources

A final income statement is labelled **Tax ready / finalised**. Final payment summaries are labelled **Finalised**.

A source marked **Not final** or **Unsure** remains visible but is excluded from final annual reconciliation totals.

That distinction prevents provisional figures from being treated as settled annual amounts.

## Multiple sources and duplicates

One employer can have more than one annual source. The user links each source individually, and multiple final sources linked to one employer are summed for the annual-source side of reconciliation.

Exact duplicate protection uses the normalised combination of:

- payer/employer name;
- source type; and
- source reference.

Matching duplicates are blocked from reconciliation totals until resolved. Different references for the same employer remain allowed.

## Reconciliation states

For each employer/source group, Xoba Paycheck shows checked payslip totals and final annual-source totals separately.

Possible states:

- **Matches checked pay history** — gross and withholding match exactly.
- **Annual source differs from pay history** — final annual totals differ from payslip totals.
- **Pay history has no final annual source** — checked payslips exist but no linked final source exists.
- **Annual source has no linked pay history** — a final annual source is present but is not linked to checked pay history.
- **Source still provisional** — only not-final/unsure linked sources are available.

For a mismatch, Xoba Paycheck shows annual source minus payslip history for gross and withholding. The mismatch remains a review question. Xoba Paycheck does not decide which source is legally correct.

## Coverage statement

The user explicitly answers whether every annual employment source they know about for the selected financial year has been added.

This is labelled as a **user coverage statement**. A Yes answer is not proof that the tax return is complete.

If an unconfirmed, duplicate or otherwise unresolved payslip could belong to the selected year, year-end reconciliation is blocked rather than silently omitting it.

## ATO terminology references

Reference version: `ato-annual-employment-sources.2026-09-20`.

Current ATO materials used for source-status wording:

- [Accessing your income statement](https://www.ato.gov.au/api/public/content/0-880e199f-24f7-4808-8de9-4f96e7e5571b)
- [Multiple income statements from one employer](https://www.ato.gov.au/api/public/content/0-9e8a6a9e-7a55-456b-8bd4-ff06ea9a2694)
- [Finalising Single Touch Payroll data](https://www.ato.gov.au/api/public/content/0-2f417730-27cf-4825-8b51-ee53bfe00358)

These references support status wording and the fact that one employer can have multiple income statements. They do not unlock Xoba Paycheck's annual-tax calculation or satisfy the qualified rule/rounding review still open in #28.

## Offline year-end pay handover

The HTML handover preserves:

- financial year;
- reconciliation and ATO-reference versions;
- the user's annual-source coverage statement;
- checked payslip source names and hashes/manual-entry references;
- every annual source, type, status, link and entered figure;
- per-employer payslip totals;
- per-employer final annual-source totals;
- gross and withholding differences;
- reconciliation states; and
- unresolved questions.

Raw payslip and annual-source files are not embedded.

Reconciliation version: `year-end-pay-reconciliation-v1`.

## Privacy and architecture

The feature is frontend-only and session-only.

- No account.
- No persistence.
- No document upload.
- No model request.
- No ATO integration.
- No TFN field.
- No portfolio-site change.

Changing the financial year or pay history resets the in-memory annual-source work.

## Verification target

Automated coverage includes:

- exact matches;
- mismatches and signed differences;
- multiple final sources for one employer;
- provisional-source exclusion;
- pay history with no final annual source;
- unlinked final annual sources;
- exact duplicate source identities;
- unresolved/unknown-date pay blocking;
- source-linked escaped report output;
- React integration;
- browser entry, provisional-to-final transition and report export;
- desktop and 390px mobile screenshots/overflow; and
- existing request monitoring for no document upload or external model request.

Feature [PR #50](https://github.com/obaonikoyi/taxprep-au/pull/50) merged as `ffe05eb13bd815780386d937b089044dcc21dfb5`. Feature CI run `35483459872` passed frontend lint/tests/build, backend/API plus browser smoke, and the production-container browser journey.

Railway feature deployment `831d9075-2be5-4c43-abd0-f626e66ab201` reached **SUCCESS** for that exact merge commit at the existing standalone URL. This publication record triggers the dedicated public hosted-browser workflow; its final evidence is recorded in issue #49. The portfolio website remains unchanged.
