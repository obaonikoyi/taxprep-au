# TaxPrep AU code walkthrough

This is a beginner-friendly tour of the current application. The frontend handles the screen and temporary entries. The backend validates requests and calculates organising amounts. Neither application saves a return or lodges with the ATO.

## Where to start

| File | What it owns |
|---|---|
| `src/frontend/src/App.tsx` | Page layout: guided demo, CSV preview and expandable developer connection check |
| `features/demo/GuidedDemo.tsx` | Current step and saved expense list |
| `features/demo/demoData.ts` | Fictional profile and three discovery questions |
| `features/expenses/ExpenseForm.tsx` | Unsaved form input, validation and example details |
| `features/expenses/ExpenseSummary.tsx` | Review request, retry, totals and evidence checklist |
| `features/expenses/expenseReview.ts` | Shared types, sample expenses and API response validation |
| `src/backend/TaxPrepAu.Api/Expenses/ExpenseReview.cs` | JSON endpoint, server validation and decimal calculations |
| `src/backend/TaxPrepAu.Api/Program.cs` | Starts the API and registers its routes |

Frontend paths beginning with `features/` are inside `src/frontend/src/`.

## One expense, end to end

1. A visitor confirms Sarah's sample income and answers Yes to phone use.
2. `GuidedDemo` opens `ExpenseForm` for the phone category.
3. The form stores text while the visitor types. This permits an empty field and avoids treating a partially typed number as a saved amount.
4. Save validates the required fields and converts valid numbers. The parent replaces the saved item for that category. Cancel leaves the old saved entry intact.
5. On the summary screen, `fetchExpenseReview` sends the saved list as JSON to `/api/expenses/review`.
6. The API validates the request again. Browser validation is helpful feedback, but callers can bypass the browser and send requests themselves.
7. The API returns decimal work portions and missing-information actions. The frontend checks the JSON shape and that the response matches the requested categories/amounts before displaying it.

For a $100 phone bill at 40% work use with no reimbursement, the recorded work portion is $40. This says how the entered cost was divided; it does not say whether $40 is deductible.

## Why the numbers live in the backend

The frontend sends the facts. The C# calculation uses `decimal`, a number type suitable for exact decimal amounts. Each item is rounded to cents before totals are added, so the visible items reconcile with the total. For example, two work portions that each round from $0.005 to $0.01 sum to $0.02.

A fully reimbursed or 0%-work item contributes zero. Partial/unknown reimbursement leaves the work portion unresolved and the subtotal is labelled partial. Missing evidence keeps the arithmetic visible but adds an action. These rules organise a small fictional example; they do not implement complete tax legislation.

## How editing avoids stale results

React's saved expense array changes whenever an item is saved or removed. The summary has a key based on that small list. A changed list unmounts the old summary, aborts its request and starts a fresh summary with no old totals. The active-request flag also ignores a late response if a transport does not respect cancellation.

The form remains editable when the API is unavailable. Retry sends the same saved entries. The 15-second timeout restores retry even if a request never settles. Restart or refresh clears the in-tab data; there is no database or local-storage copy.

## The separate CSV flow

1. `components/TransactionUpload.tsx` accepts a file or loads the bundled fictional sample.
2. `features/transactions/importPreview.ts` sends multipart form data to `/api/transactions/import-preview` and validates the JSON response.
3. `Transactions/ImportPreviewEndpoint.cs` checks file/request limits and encoding.
4. `Transactions/CsvTransactionParser.cs` validates headers, quotes, dates, amounts and rows. Independent valid rows survive row errors.
5. The browser displays valid transactions, row errors and the API's net total.

There is one authoritative CSV parser in C#. The CSV preview does not automatically populate the guided expense form. Connecting those workflows is future work.

## How the preparation report works

`features/reports/ReportExport.tsx` appears only after a successful expense review. It creates one report snapshot from that saved list and matching API response. The summary's existing remount behaviour removes the snapshot after an edit, so the next export cannot silently reuse the old totals.

`features/reports/preparationReport.ts` turns the snapshot into a complete HTML document. It copies the API's work portions and checks that displayed cent amounts reconcile with its totals; it never repeats the work-use calculation. Every variable text value is HTML-escaped, so typing `<img>` in a note produces visible text rather than an image element. `report.css` is bundled into the document, making it independent of the running app.

The same HTML string feeds the preview, the download and browser printing. A temporary Blob URL lets the browser save a file without a new API call. The preview iframe permits printing and same-origin access but cannot run report scripts. The report contains no scripts or external resources. Print readiness is checked before calling that frame's `window.print()`.

For example, if the API returns a $40 work portion, the page and report both display $40. Editing the cost creates a new review and report; it cannot alter a file the visitor already downloaded.

## What to learn from this milestone

- **State ownership:** explain why typing belongs to the form but saved entries belong to the journey. Try Cancel after changing an amount.
- **Validation boundaries:** explain why both the form and API validate. Try 101% work use, then inspect the API integration tests for a direct invalid request.
- **Portable snapshots:** explain why the downloadable report is a separate copy, and why escaping text and waiting for print readiness matter.
- **Deterministic calculation:** explain why missing evidence, unclear reimbursement and tax eligibility are separate from multiplying an amount by a percentage.

## Running and verifying

Use [the development guide](DEVELOPMENT.md). Frontend tests cover interactions and API contracts. Backend tests use `WebApplicationFactory` to send real HTTP requests through the application in memory. The browser smoke script runs the real API and Vite together, checking the guided expense journey and CSV preview at desktop/mobile widths.

The calculation scope is in [Milestone 5](MILESTONE_5_EXPENSE_REVIEW.md). The export contract and browser checks are in [Milestone 6](MILESTONE_6_PREPARATION_REPORT.md).
