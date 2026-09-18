# Milestone 12A — income, coverage and a combined handover

Implements [issue #25](https://github.com/obaonikoyi/taxprep-au/issues/25), the first part of Milestone 12. The app now brings recorded income and tax withheld into the document workspace and exports a combined preparation handover. Return calculations and field-by-field myTax mapping remain later work. [Issue #21](https://github.com/obaonikoyi/taxprep-au/issues/21) remains open for qualified review of the phone rules and examples.

## Try the visitor journey

1. Choose **Try document intake**, 2025–26 and the employee example, then **Start document review**.
2. Use the sample documents, review and link the payment and receipt, and complete the draft phone assessment if desired.
3. Choose **Preparation summary**, then **Load fictional income example**. This supplies two employers, one interest entry and clearly fictional circumstances. There is no ATO pre-fill connection.
4. Review the three source records and choose **Confirm income record** for each. Recorded gross income is **$82,150** and tax withheld is **$17,100**. A completed sample phone illustration remains a separate **$18**; it is not subtracted as an approved deduction.
5. Review situation/coverage answers and the remaining gaps, then **Download preparation handover**. Incomplete work is exportable with its gaps listed.

Manual records are also supported: up to 20 annual salary/wage or Australian bank-interest records. Interest is initially limited to sole ownership. Joint or uncertain ownership is explicitly unresolved. No salary, withholding or interest is inferred from net bank deposits, transfers or expense CSV rows. Income-statement OCR is not implemented in this stage.

## What changed

- Two views within the same session: Documents and Preparation summary. Income state is kept in the parent workspace, so switching views does not discard it.
- Each income record retains type, payer label, fictional source reference, financial year, gross amount, withheld amount, finality, review status and input origin. Samples retain original values when edited; manual records are explicitly manual input, not extracted statements.
- Blank is not zero. Money is parsed to bounded integer cents; zero withholding is valid only when entered explicitly. Invalid amounts, withholding greater than gross, wrong-year records, unfinished sources, unreviewed records and unsupported ownership are excluded from the recorded subtotals with reasons.
- Matching payer/type/year or source-reference/year combinations flag possible duplicate annual records, including amended statements with different amounts. No record is silently deleted. Review both and either remove the duplicate or explicitly mark separate records. Different names/references can evade this heuristic; it is not proof that the list is duplicate-free.
- Editing a record clears its review, related separate-record decisions and the income-list completeness answer. Removing a record also clears list completeness. All totals and reports derive from current state.
- The situation checklist records residency, adult scope, Medicare, household, health insurance, study loans, extra employment fields, reportable benefits/super, other income and other deductions/offsets/losses. Unknown is not treated as no. Unsupported sections remain visible; notes preserve the handover question rather than guessing a tax treatment.
- Existing reconciled evidence and draft phone calculations are reused. Duplicate expenses, changed evidence, failed imports and possible supplier credits carry through as gaps. Recorded income, tax withheld and illustrative phone portions are distinct values.
- One offline HTML handover includes current income facts, original sample values, source references, separate-record decisions, circumstances, gaps, notes, original/corrected document facts and the existing ATO rule/source version trail. Source files are not embedded.

## Boundaries and provenance

This is an incomplete preparation, not a tax return or a myTax entry guide. No taxable income, tax rates, offsets, Medicare levy/surcharge, loan repayments, refund or amount payable is calculated. Recorded tax withheld is not a validated tax credit or a refund estimate. Even all-supported sample answers retain the review and calculation gaps; there is no claim-ready result.

No TFNs, bank/account or membership numbers, myGov credentials or real identities are requested. No new API, database, document upload, external model or browser storage was added. Closing, refreshing, leaving the document workspace or clearing its session removes income and documents. The older guided demo has its separate opt-in progress storage; it does not save this workspace. The sample loader cannot replace a preparation that already contains entered information.

Input guidance was checked directly on ATO pages on **18 September 2026**:

- [myTax 2026 salary and wages](https://www.ato.gov.au/individuals-and-families/your-tax-return/instructions-to-complete-your-tax-return/mytax-instructions/2026/income/salary-wages-or-other-income-on-an-income-statement-or-payment-summary/salary-and-wages): 2025–26 statement inputs, including separately reported employment fields. The app intentionally does not implement every myTax field.
- [myTax 2026 interest](https://www.ato.gov.au/individuals-and-families/your-tax-return/instructions-to-complete-your-tax-return/mytax-instructions/2026/income/australian-income-or-losses-from-investments-or-property/interest): gross interest, amounts withheld, ownership and residency distinctions. This first input path flags joint ownership for separate work.
- [Income statements](https://www.ato.gov.au/individuals-and-families/jobs-and-employment-types/working-as-an-employee/income-statements): finality/tax-ready status and missing or incorrect sources.
- [myTax 2026 sections](https://www.ato.gov.au/individuals-and-families/your-tax-return/instructions-to-complete-your-tax-return/mytax-instructions/2026): broader return coverage that remains unprepared.

These references support input collection, not professional approval of the app. No return rules or operating-model approvals were invented. Phone-source snapshots and review status remain as documented in Milestone 11.

## Implementation and verification

`features/preparation/preparation.ts` owns the input model, integer-cent subtotals, duplicate detection and gap calculation. `IncomeEditor` owns the record controls; `PreparationWorkspace` combines current income with the existing evidence state. `preparationReport` supplies an escaped introduction to the existing evidence report renderer, preserving the full document trail in one HTML file. Report layout HTML comes only from application renderers; user values are escaped.

The unit cases verify money parsing, zero/blank, partial totals, year/finality/ownership errors, duplicates, edit invalidation, removal, unknown/unsupported circumstances, source continuity, no bank-deposit inference and escaped exports. The actual browser scenario checks the same flow with a real OCR-derived phone assessment, manual records, corrected salary, duplicate decisions, joint-account flags, mobile layout and offline report reopening. It also verifies the preparation responds to a later supplier credit and is erased by clearing the document session. Existing document checks continue to assert no upload/external model request.

Software tests validate the implementation, not tax correctness. Milestone 12's next part still needs an explicitly bounded return model, versioned calculation inputs/rules, reviewed expected outcomes and a suitable operating model before reliable real-user tax conclusions.

The standalone demo can publish this fictional-data feature. The portfolio website remains unchanged.
