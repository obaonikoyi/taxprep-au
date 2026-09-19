# Milestone 13 — local bank-statement analysis

[Issue #32](https://github.com/obaonikoyi/taxprep-au/issues/32) delivers an immediately usable statement-to-report workflow and refreshes the default dashboard. It takes priority over the separate income-document extraction backlog item #30.

## Try it

1. Open the standalone app and select **Try example statement**. The fictional example runs through the same PDF reader as a selected file.
2. See 33 transactions across July–September 2025: $12,649 received, $5,016.75 out and $7,632.25 net movement. Opening balance $1,250 and closing balance $8,882.25 reconcile.
3. Explore debit categories, monthly movements and possible recurring payments. Transfers and repayments have separate categories; cash movement is not taxable income or approved deductions.
4. Search **Harbour Repairs**, open a transaction, change its category, flag it for work review and add a note. **Apply review** commits that decision without editing source amounts or dates.
5. Change the dates to narrow the overview and export. Search/category filters affect the table only. Download the HTML report and open it offline.
6. Select a supported statement of your own to analyse locally. Export before replacing, clearing, switching workspaces or refreshing: the session has no persistent storage.

## Supported input and integrity checks

- One PDF or UTF-8 CSV, 1 byte–10 MB; file name at most 180 characters.
- PDF: 1–60 pages, at most 200,000 text tokens and 5,000 transactions, statement period at most one year. Reading has a 60-second cancellation limit.
- Native-text CommBank-style `Date / Transaction / Debit / Credit / Balance` tables with a printed period, opening/closing entries and four-value totals summary. This is a specific observed layout contract, not support for every CommBank product or historical format.
- The parser uses column coordinates, preserves descriptions across lines/pages, ignores left printer marks, retains posting and value dates separately, supports CR/DR and Nil balances, and distinguishes an informational interest notice from a posted debit.
- Every running balance, debit/credit total and opening-to-closing movement must match exactly in integer cents before import. Missing, ambiguous or inconsistent entries reject the import. A failed replacement preserves existing work and review notes. Zero-activity statements are valid when all printed checks match.
- CSV requires exactly `Date,Description,Amount`, 1–5,000 rows, valid `YYYY-MM-DD` or `DD/MM/YYYY` dates, nonempty descriptions up to 1,000 characters and signed decimal amounts with at most two fractional digits. Negative means money out. Zero is valid; malformed records reject the whole file. CSV has no ledger reconciliation and is clearly labelled accordingly.
- Scans, encrypted PDFs, other table layouts, combined statements and arbitrary bank CSV schemas are not promised. Export to the supported CSV contract where necessary.

Reconciliation catches missing or misread amounts; it does not prove that every merchant description or date was interpreted correctly. The report retains source page/row locations for review. Dates are filtered by posting date. No bank account identifiers or document headers are copied into the analysis model, but transaction descriptions can contain personal information and exported reports should be treated accordingly.

## Analysis and review

All amounts use integer cents. Total credits/debits include transfers, refunds and repayments. There is no inference of gross salary or tax withheld from deposits, and no integration with the separate draft tax engine.

Categories use deterministic merchant-description keywords. Users can correct each category, choose unreviewed/personal/check for work use, and record a note. Marking work use does not approve a deduction. Categories and corrections are labelled separately.

Recurring suggestions need at least three distinct dates, amounts within 20%, and approximately weekly, fortnightly or monthly spacing without a large gap. Transfers and repayments are excluded. These are possible patterns, not confirmed subscriptions. Similar entries share date, amount and normalised description; they remain counted because the source statement includes them.

The table offers search, category filtering and 20-row pagination. Date selection controls overview totals and the export. Offline HTML includes selected transactions, suggested/reviewed categories, notes, possible recurrence, parser version, file hash and complete-statement checks with their scope stated explicitly. Text is escaped; the report has no scripts, external resources or original PDF embedded.

## Privacy and architecture

`features/statements` separates PDF/CSV reading, pure parsing, analysis, UI and export. PDF.js and Papa Parse are existing pinned dependencies. PDF assets are served from the application's own origin. The file is never posted to the API, sent to a model, stored in localStorage/IndexedDB or retained on a server. Source bytes are released when reading finishes; extracted rows exist only in the active workspace. Downloaded reports remain on the user's device until they remove them.

The example is public fictional data. Supplied private documents and extracted private records remain outside Git, CI, screenshots and deployed assets. The fixture generator creates independent invented merchants and figures. No real statement is disguised and republished as a fixture.

The older **Expense demo** and **Try document intake** workspaces retain their existing contracts, including their separate limits and explicit progress-save behaviour. Statement analysis does not raise receipt-OCR limits or add persistent financial storage. The tax review gates in #21 and #28 remain open.

## Verification

- 26 new unit cases read actual synthetic PDF bytes through PDF.js and exercise multiline/cross-page descriptions, printing marks, posting/value dates, zero activity, mismatched totals, missing transactions, strict money/calendar/CSV validation, category corrections, recurring/similar entries and escaped date-scoped export.
- Local private compatibility checks cover the supplied statement layouts without adding originals or extracted financial data to the repository.
- `statement-smoke.mjs` is part of the production-container and public-hosted browser journeys: PDF sample, reconciled totals, filters/review/date selection, charts, desktop/mobile screenshots, offline export, failed replacement, empty statement, CSV, clear and refresh. It checks for page errors, document uploads and external requests.
- Existing expense, save/resume, receipt OCR, phone assessment and preparation/tax-position browser flows run alongside the new journey.

## Next work

Roadmap updated 19 September: [Milestone 14 payslip dashboard](MILESTONE_14_PAYSLIP_DASHBOARD.md) / #35 is next. Annual statement extraction #30 remains a separate deferred reconciliation input, followed by combined year-end preparation #37. Broader bank formats and AI-assisted explanations can follow with explicit accuracy and data-handling contracts. This release is a useful statement analyser, not a complete tax-return service.

## Publication record

- Feature merged in [PR #33](https://github.com/obaonikoyi/taxprep-au/pull/33), commit `ed4e5dbfe0dd2309014b57c694c5a40af4925e83`.
- [Feature CI](https://github.com/obaonikoyi/taxprep-au/actions/runs/35414464489) passed Frontend, Backend and Production container: 273 frontend tests, lint/build, API and existing browser regressions, plus the statement journey.
- Production artifact `10575855858` confirms reconciled synthetic PDF totals, category corrections with unchanged source amounts, pagination/filtering/date selection, invalid-import preservation, zero activity, CSV, clear/refresh and offline export. Desktop/mobile screenshots inspected; no page overflow, page errors, statement uploads or model requests.
- Railway feature deployment `f092eade-d1ca-4b74-934b-61f781b5f338`. The publication PR updates `deployment.json` to run the actual public visitor journey before merge.
- [Standalone app](https://taxprep-au-production.up.railway.app) only. Portfolio site unchanged; private statements and their extracted records are not published.
- #32 tracks this milestone. #30 remains a deferred annual-income extraction stage; qualified tax review remains open in #21 and #28.
