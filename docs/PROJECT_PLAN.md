# TaxPrep AU — delivery plan

Updated 19 September 2026. This plan replaces the original organiser-only delivery plan. [Product direction](PRODUCT_DIRECTION.md) governs the goal; each milestone document defines what is actually implemented.

## Product promise

Help Australian workers understand their pay, track withholding and recorded super, and prepare for tax time with fewer surprises. Preserve the original goal: help with straightforward self-preparation or provide an organised accountant handover.

The first useful result should require no account: try fictional payslips or enter supported pay figures, check the data and see a readable history. Convenience, accuracy and uniqueness are hypotheses to evaluate, not marketing claims established by tests.

## Current milestone and next stages

| Stage | User outcome | Status / tracking |
|---|---|---|
| 1–9: application foundation | Guided expense review, CSV preview/API, report, explicit sample progress and standalone hosting | Implemented; historical milestone documents retained |
| 10: document intake | Read fictional receipts, reconcile evidence, correct facts and export | Implemented; [scope](MILESTONE_10_DOCUMENT_INTAKE.md) |
| 11: phone assessment | Explain a bounded draft work-use illustration with sources | Engineering implemented; qualified review remains open in [#21](https://github.com/obaonikoyi/taxprep-au/issues/21) |
| 12A: preparation handover | Record annual income, withholding, coverage and questions | Implemented; [scope](MILESTONE_12A_PREPARATION_HANDOVER.md) |
| 12B: fictional tax position | Demonstrate a restricted annual calculation | Engineering implemented; qualified source/rounding review remains open in [#28](https://github.com/obaonikoyi/taxprep-au/issues/28) |
| 13: statement analysis | Local bank PDF/CSV analysis, categorisation and report | Published; [scope](MILESTONE_13_STATEMENT_ANALYSIS.md) |
| **14: payslip dashboard** | Confirm pay facts, explore earnings/withholding/super charts, review changes and export | Published: [#35](https://github.com/obaonikoyi/taxprep-au/issues/35), [implementation and publication record](MILESTONE_14_PAYSLIP_DASHBOARD.md) |
| **15A: pay outlook** | Explore explicit one-employer regular-pay scenarios through 30 June without treating withholding as final tax | Published: [#43](https://github.com/obaonikoyi/taxprep-au/issues/43), [scope and publication record](MILESTONE_15A_PAY_OUTLOOK.md) |
| **15B-1: tax readiness** | Collect whole-year profile facts, missing information and unsupported circumstances without producing a tax estimate | Published: [#46](https://github.com/obaonikoyi/taxprep-au/issues/46), [scope and publication record](MILESTONE_15B1_TAX_READINESS.md) |
| **15B-2: reviewed withholding/tax outlook** | Apply reviewed declaration-aware PAYG schedules and a bounded annual-tax position | Planned under [#36](https://github.com/obaonikoyi/taxprep-au/issues/36); depends on qualified review in #28 |
| **16A: employment-source reconciliation** | Compare checked payslip history with final annual employment sources without double counting | Published: [#49](https://github.com/obaonikoyi/taxprep-au/issues/49), [scope and publication record](MILESTONE_16A_INCOME_RECONCILIATION.md) |
| **16B: annual statement extraction** | Read a documented local PDF/image annual income statement into reviewed reconciliation candidates | Published: [#30](https://github.com/obaonikoyi/taxprep-au/issues/30), [scope and publication record](MILESTONE_16B_ANNUAL_STATEMENT_EXTRACTION.md) |
| **16C-1: unified year-end preparation** | Add optional bank-deposit completeness checks and expense/evidence coverage to one session-only handover | Published: [#54](https://github.com/obaonikoyi/taxprep-au/issues/54), under [#37](https://github.com/obaonikoyi/taxprep-au/issues/37); [scope and publication record](MILESTONE_16C1_YEAR_END_PREPARATION.md) |
| **16C-2: portable cross-workspace handoff** | Explicitly carry privacy-bounded Bank spending / Tax documents coverage into the year-end hub without persistence | In progress: [#57](https://github.com/obaonikoyi/taxprep-au/issues/57), under [#37](https://github.com/obaonikoyi/taxprep-au/issues/37); [scope](MILESTONE_16C2_PORTABLE_HANDOFF.md) |
| **16C+: save/resume + user validation** | Define safe persistence, retention/deletion and validate the broader preparation journey with users | Planned under [#37](https://github.com/obaonikoyi/taxprep-au/issues/37); [design gate](YEAR_END_SAVE_RESUME_DESIGN.md) |
| Later: coverage and integrations | Broader payroll layouts, reviewed tax treatments, supported AI extraction and authorised integrations | Separate scopes after measured user trials and appropriate operating arrangements |

Milestone 16A began with manual annual-source entry. Milestone 16B / [#30](https://github.com/obaonikoyi/taxprep-au/issues/30) adds one documented local annual-income-statement reader that feeds reviewed candidates into the same reconciliation model. An annual statement and the payslips it summarises are two views of the same employment income and must not be counted separately.

Milestone 14 usability follow-up [#40](https://github.com/obaonikoyi/taxprep-au/issues/40) simplified the Add → Check → Summary journey. Milestones 15A and 15B-1 are published; applying reviewed PAYG/annual-tax rules remains gated by #28.

## Eight user cases

1. Try a fictional history immediately, without creating an account.
2. Upload supported payslips or enter figures when the layout is unsupported.
3. Compare extracted text with editable fields and confirm the current-period figures.
4. See gross pay, take-home pay, withholding dollars/percentage and recorded super across employers and periods.
5. See duplicates, arithmetic inconsistencies, overlaps, possible gaps and observed changes, with clear limits on what was checked.
6. Choose one employer/year and compare explicit regular-pay scenarios; later, supply the necessary tax profile for reviewed tax-position logic.
7. Keep expense evidence organised alongside pay history for tax preparation.
8. Export an understandable source-linked report, then prepare through myTax or discuss it with an accountant.

Cases 1–5 and the pay-history part of case 8 are the Milestone 14 outcome. Milestone 15A adds bounded pay arithmetic for case 6 without tax conclusions. Milestone 15B-1 adds whole-year profile readiness while leaving the tax-result gate locked. Milestone 16A starts case 8 year-end handover work by reconciling pay history with annual employment sources without double counting. Milestone 16B reduces manual re-entry for one documented annual statement layout while keeping explicit review and provenance. Milestone 16C-1 adds session-only bank-deposit completeness checks and expense/evidence coverage without deriving income from deposits or approving deductions. Milestone 16C-2 adds an explicit, privacy-bounded JSON handoff so reviewed coverage and source hashes can move between local workspaces without hidden persistence or raw transaction/OCR transfer. Reviewed withholding/tax forecasts, saved histories and user validation remain later work.

## Milestone 14 delivery checklist

- A separate default Payslip dashboard; other workspaces remain accessible.
- One documented labelled native-text PDF layout; bounded batch reading; manual fallback.
- Six entirely invented PDF samples through the real reader, pre-reviewed only in example mode.
- User-file confirmation before charts; edits invalidate confirmation immediately.
- Integer-cent arithmetic, missing-value handling, exact duplicates and cumulative-YTD exclusion.
- Employer/year filters and payday/month charts, with exact accessible tables.
- Source text, original values, user corrections, outstanding reviews and offline report.
- Local session only: explicit clear, refresh and workspace-change behaviour; no cloud or model upload.
- Parsing and money tests plus actual browser PDF → review → chart → correction → export checks.
- Checked feature PR, standalone deployment, live verification and publication record.

## Architecture

React/TypeScript/Vite frontend with ASP.NET Core 8 API. The new payslip workspace processes documents locally using the existing pinned PDF.js dependency. The API continues serving its existing health/import routes; this stage introduces no persistence service or AI provider.

`features/payslips` separates pure facts/validation/analysis, PDF reading, review, charts, dashboard orchestration and HTML export. Money uses integer cents. Source hashes identify exact files; employer + period + pay date catches likely repeated payroll records. Source text is untrusted data and never rendered as HTML or interpreted as instructions.

AI can later extract and explain supported information, with uncertainty and source references. Calculations remain tested code. A model response does not establish tax eligibility or approve a rule update.

## Quality and privacy

Use only independent fictional fixtures in Git, CI, screenshots and deployed examples. Do not commit personal financial records, identifiers or extracted private data. No sensitive history is persisted in this milestone. User reports stay on the user's device; raw PDFs are not embedded.

Test supported and unsupported input, wrong totals, missing amounts, period boundaries, repeated files, corrected duplicates, changed confirmation, partial super coverage, filtered exports, keyboard labels and mobile overflow. Run existing API/document/statement regressions in CI. Record what was verified without presenting software test success as tax-law approval.

A future saved history needs an explicit retention/deletion and access-control design. Public paid personalised tax services and ATO integrations retain their separate operating-model requirements. Existing qualified-review issues stay open.

## Learning and portfolio evidence

Explain the problem, supported input contract, why YTD totals can double-count, why document extraction and tax judgement differ, and how confirmed/corrected data changes derived charts. Demonstrate source traceability, deterministic calculations, accessible React UI, tests, CI and deployment.

The standalone app may be published under the user's existing authorisation. The owner's portfolio website remains unchanged until the user chooses to showcase the useful result. Do not advertise forecast, payslip correctness, AI analysis or tax-agent replacement as current features.
