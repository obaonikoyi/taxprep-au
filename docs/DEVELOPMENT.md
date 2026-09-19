# Development guide

## Requirements

Node.js 22.12+ (Node 24 also supported), npm, .NET 8 SDK and Git. In Visual Studio 2022, use the ASP.NET and web development workload.

## Start the app

Clone the repository, or fetch/pull the latest `main` in a clean working tree. Run these commands from the repository root in two terminals.

Terminal 1 — API:

```powershell
dotnet restore TaxPrepAu.sln
dotnet run --project src/backend/TaxPrepAu.Api --launch-profile http
```

The Development profile listens at `http://localhost:5087`. `/api/health` returns `healthy`.

Terminal 2 — React:

```powershell
cd src/frontend
npm ci
npm run dev
```

Open `http://localhost:5173` (or Vite's printed URL). The Vite development proxy sends `/api` to port 5087. Use the explicit `http` profile above to avoid a certificate/port mismatch. Production must serve HTTPS and forward `/api` to the backend; Vite's development proxy is not a production deployment configuration.

## Try the connected CSV flow

1. Scroll to **Review your transactions**.
2. Click **Try sample CSV**, or upload `sample-data/transactions.csv` and click **Preview transactions**.
3. Expect 20 valid rows, no errors, and **$1,374.12 net**.
4. Try a fictional invalid date or a missing heading and inspect the error.
5. Clear the preview. Stop the API and retry to see a recoverable service error; restart it and retry the selected file.
6. Select **Sunrise Mobile Services**, choose **Phone service** and click **Review selected spending**. Enter 40% work use, no reimbursement and missing evidence; save to see an $18 work portion.
7. Inspect its source row in the summary and report. Upload the same sample again: that row is unavailable. Remove the expense to release it, or restart to clear the session.

The upload sends the CSV to TaxPrep AU and processes it in memory. Use fictional data. Expenses and source references remain in this tab unless saved with **Save progress**. That explicit snapshot stays in the same browser; nothing is persisted on the server, classified as deductible or submitted to the ATO.

## Try the guided expense review

1. Click **Explore example summary** to load three fictional expenses.
2. Expect $792.60 entered, $312.60 recorded work portions and one item needing attention.
3. Edit the phone expense: $100 at 40% produces a $40 work portion. The combined total becomes $112.60.
4. Select **Partly reimbursed / not sure** to see an unresolved amount and a clearly labelled partial total.
5. Remove an expense, add a skipped category or restart. Cancel changes preserves the previous entry; restart clears the tab and saved browser copy; refresh keeps only the last explicit Save progress snapshot.
6. Alternatively, choose **Try demo**, confirm sample income and answer each Yes/No question. **Use example details** speeds up each form.
7. Stop the API while requesting a summary. Entries remain editable; restart the API and click **Retry review**.

[Milestone 5](MILESTONE_5_EXPENSE_REVIEW.md) explains input bounds, rounding and the difference between work portions and tax eligibility.

## Save and resume

1. Enter an unfinished expense or complete the summary, then click **Save progress**.
2. Refresh or reopen the page in the same browser and choose **Resume saved progress**.
3. Confirm the step, draft text and source references return. The CSV preview must be empty.
4. For a resumed summary, verify a new review request and report. Stop the API to check retry without cached totals.
5. Make an edit: the controls should mark it unsaved until you click Save progress again.
6. Delete the saved copy and verify current entries remain. Restart must clear both.
7. Open a second tab and resume. Save a change in the first tab; the second must announce it and preserve its current entries until explicit resume.

[Milestone 8](MILESTONE_8_SAVE_RESUME.md) documents the schema, size limits, storage failures and conflict limitations. Saving is explicit, local to this browser profile and origin, and for fictional data only.

## Keep a report

1. Complete a review or click **Explore example summary** with the API running.
2. Expand **Preview report**, then click **Download report (HTML)**.
3. Open the downloaded `.html` file in a browser. It works offline and includes the evidence checklist and references.
4. **Print / save PDF** opens the browser print dialog for the report. Select A4 and Save as PDF where supported. The direct download remains HTML.
5. Change an expense and save it. Export is available again after the new review succeeds; earlier downloaded copies keep their original values.
6. No export is shown for an empty, loading or failed review. If printing is unavailable, download the HTML and use that browser's Print command.

See [Milestone 6](MILESTONE_6_PREPARATION_REPORT.md) for format boundaries and verification details.

## Automated checks

From the repository root:

```powershell
dotnet test TaxPrepAu.sln --configuration Release
cd src/frontend
npm test
npm run lint
npm run build
```

`dotnet test` builds and runs real endpoint tests using `WebApplicationFactory`. Vitest runs React interaction tests and API-client contract tests. GitHub Actions runs both suites and both builds on pull requests and changes to `main`.

## Troubleshooting

- **Service unavailable:** ensure the API is running on 5087 using the `http` profile, then retry.
- **Port already in use:** stop the older local process instead of changing committed ports.
- **Empty or unsupported CSV:** use UTF-8 and the documented columns; inspect the file/row error list.
- **Preview took too long:** the UI cancels after 15 seconds and permits retry.

See [Milestone 4](MILESTONE_4_IMPORT_API_TESTS.md) for supported formats, bounds and the API response contract.


## Real browser verification

For the built production container and a standalone deployment, see [Milestone 9](MILESTONE_9_STANDALONE_DEMO.md). `npm run test:hosted` checks a running production app using `DEMO_URL` (defaults to `http://127.0.0.1:8080`), including CSV import, a phone expense, downloaded report, save/resume and mobile layout. It does not launch a server. Production CI builds and runs the actual Docker image before that check.

After a Release backend build, run from `src/frontend`:

```powershell
npx playwright install chromium
npm run test:e2e
```

The script starts/stops its own API and Vite processes on 5087/5173 (stop your development servers first). It checks the guided expense interview, edits and partial totals, manual mobile entry, validation focus, real service interruption/retry and reset, plus real localStorage save/resume, new-tab restoration, two-tab conflicts, corrupt-copy recovery, and the CSV upload regression flow and selected spending → expense draft → API review → offline report. It checks renamed/reordered uploads, original versus adjusted amounts, unsupported rows, cancellation and the 50-row grouping limit. Desktop and 390px mobile widths are covered. The report checks verify the print action and browser print-event capability, real HTML download bytes, offline reopening without network requests, partial amounts and long notes. They also generate A4 PDFs from the downloaded HTML for inspection. It writes screenshots and a JSON report to ignored `test-results/browser/`. CI installs browser system dependencies and uploads these files alongside the API test report as a seven-day artifact.

## Draft assessment verification

`npm test` and `npm run build` first verify the three captured ATO source hashes and rule bindings. Assessment rules and evidence-continuity cases run in Vitest; the existing browser scripts now cover document → linked payment → draft phone assessment → source/versioned export, including overlap, partial reimbursement, duplicate and refund blockers. See [Milestone 11](MILESTONE_11_PHONE_ASSESSMENT.md) for the qualified-review gate.

## Income and combined handover

Milestone 12A adds unit cases for annual-income validation, partial cent totals, duplicate decisions, changes that invalidate review, scope gaps and escaped reports. `preparation-smoke.mjs` is called from the existing actual document browser journey, so both production-container and public-hosted verification test the combined income/evidence export and offline reopening. Data remains tab-only; clearing the document session clears preparation inputs as well.

## Tax-position calculation

Milestone 12B adds `features/tax-position` with integer-cent arithmetic, explicit scope blockers and source bindings. `verify-tax-sources.mjs` runs before tests/builds. `tax-position-smoke.mjs` runs in the production and hosted document journey, including both balance directions, unknown/expense blockers, edit invalidation, thresholds and the offline handover. The result remains fictional; see [rule and rounding contract](MILESTONE_12B_TAX_POSITION.md).

## Statement analysis

Choose **Statement analysis** from the workspace navigation; choose **Expense demo** for the older API workflow or **Try document intake** for OCR and preparation. The statement workspace runs entirely in the browser. `statement-smoke.mjs` is included in `test:hosted` for production and public verification. `statementParser.test.ts` extracts real PDF text from wholly fictional fixtures before checking the parser and analysis. Fixture generation uses `python sample-data/statements/generate.py` with ReportLab from the repository root; normal builds use the committed JSON fixtures and need no Python. Never add private statements or their extracted text to the fixtures, logs or CI. See [Milestone 13](MILESTONE_13_STATEMENT_ANALYSIS.md).

## Payslip dashboard

The default workspace is **Payslip dashboard**. The reader, pure facts/analysis, review, charts and report live in `features/payslips`. `payslip.test.ts` reads actual synthetic PDFs; `payslip-smoke.mjs` is included in the production and public `test:hosted` journey. Examples are lazy-loaded from `sample-data/payslips/examples.json` and use the real reader. See [Milestone 14](MILESTONE_14_PAYSLIP_DASHBOARD.md) for supported labels, bounds, confirmation and privacy behaviour. No new API endpoint or remote provider is required.
