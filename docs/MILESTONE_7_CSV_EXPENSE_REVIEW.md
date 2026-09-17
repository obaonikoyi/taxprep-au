# Milestone 7 — CSV spending to expense review

## Outcome

A visitor can select validated spending, choose a supported category, complete an editable expense draft, and download a report that preserves the original CSV rows.

[Tracking issue #11](https://github.com/obaonikoyi/taxprep-au/issues/11).

## Try it

1. Start with a fresh demo and click **Try sample CSV**.
2. Select **Sunrise Mobile Services** ($45 spending) and choose **Phone service**.
3. Click **Review selected spending**. The amount is prefilled; work use, reimbursement and evidence still need answers.
4. Enter 40% work use, no reimbursement, and missing evidence. Save the expense.
5. The API returns an $18 recorded work portion with missing-information actions.
6. Open the source transaction details or download the report. Both retain the original CSV file, physical row, date, description and signed amount.

This is arithmetic and preparation, not a deduction decision. A transaction does not establish work use or replace supporting evidence.

## User stories delivered

- Select spending and see an exact selected total before opening a form.
- Group up to 50 selected rows into one category record.
- Choose the category explicitly and answer work-use/reimbursement/evidence questions without automatic assumptions.
- Edit the recorded amount while preserving the original transactions and showing the adjustment.
- Keep source references in the form, summary and offline HTML/printed report.
- Reopen or rename the same CSV without silently adding the same spending twice.
- Cancel drafts, clear/replace previews, remove records and restart with predictable results.

## Scope and limits

- The demo year is **1 July 2025 to 30 June 2026**. Out-of-year rows remain visible but cannot be selected. The bundled sample dates now match this year; its 20 rows and $1,374.12 net total are unchanged.
- Only negative amounts can become expense drafts. Incoming and zero amounts remain in the preview.
- Supported categories remain transport fares, phone service and protective clothing. No automatic category or tax-eligibility suggestions are made.
- There is still **one saved record per category**. Multiple selected rows share one work-use percentage, reimbursement status and evidence checklist. Rows requiring different treatment should not be grouped; multiple independent records per category are future work.
- An occupied category is unavailable. To replace it, explicitly remove its record first; there is no silent overwrite or merge.
- At most 50 rows can form one expense, with an entered/selected total no greater than $1,000,000. There is no select-all shortcut that could hide incompatible rows.
- Original rows are reference snapshots, not receipt attachments. Editing an amount does not edit those snapshots or calculate an adjustment automatically.

## State and duplicate behavior

`GuidedDemo` owns the saved expense list and renders `TransactionUpload` with that list and a callback. `TransactionSelection` owns only the current checkbox/category selection. `ExpenseForm` owns the unsaved draft.

The duplicate key combines exact date, trimmed description, signed amount and occurrence number. Filename and physical row number are deliberately excluded so renamed or reordered copies still match. Identical repeated rows within a file have separate occurrence numbers. Matching is limited to this session and this exact content; changed descriptions or different statement formats are not fuzzy-matched. Without a bank transaction ID, identical transactions across different files can be ambiguous.

| Action | Result |
| --- | --- |
| Open an import draft | Copies selected rows; does not reserve them yet |
| Save | Adds the category record and reserves its source keys |
| Cancel | Drops the draft; saved records remain unchanged |
| Edit amount/notes | Keeps original source references; obtains a fresh API review |
| Clear/replace CSV preview | Clears checkbox selection; saved records and an open draft remain |
| Upload matching rows again | Marks previously saved rows unavailable, naming their category |
| Remove expense | Releases its source keys and clears the old review/export |
| Restart | Clears expenses, preview, draft, duplicate tracking and the saved browser copy |
| Refresh | Clears unsaved work; Milestone 8 can resume the last explicit browser snapshot |

## Data boundaries

There is no new endpoint or backend calculation. The existing CSV API validates the upload; only its valid rows can be selected. The existing expense API validates the saved expense facts and returns rounded work portions and missing-information actions.

The browser sums selected spending using integer cents. It never recomputes the API's work portions. Source metadata stays in browser memory and the exported snapshot; `fetchExpenseReview` explicitly sends only fields in the existing API contract. The original upload still sends the CSV to the parser for in-memory validation.

The report escapes source descriptions and filenames, includes every saved source row, and excludes unselected rows. Source tables wrap long text and repeat table headers when printed. Reports remain script-free and work offline.

## Verification

- Unit tests: cent totals, financial-year edges, incoming/zero spending, row/amount caps, renamed/reordered duplicates and distinct repeated rows.
- Journey tests: explicit required answers, grouped draft amounts, source metadata excluded from the API payload, report references, category protection, preview clearing, cancellation, removal and restart.
- Report tests: malicious-looking filenames/descriptions render as text, Unicode survives, adjustments remain distinct and downloaded copies stay immutable.
- Browser checks: real CSV upload → editable form → real expense API → offline report; partial CSV errors, mobile layout, amount edit, repeated upload, removal/cancellation and the full 50-row limit.
- Existing frontend/API tests and expense/CSV/report browser regressions remain in CI. A4 PDFs and screenshots are uploaded for visual review.

## Follow-up delivered

[Milestone 8](MILESTONE_8_SAVE_RESUME.md) adds explicit same-browser save/resume, including selected source references and unfinished imported drafts.
