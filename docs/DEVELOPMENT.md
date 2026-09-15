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
6. Sarah's separate guided expense summary also uses the API. Its questions and editable form remain usable if the server is temporarily unavailable.

The upload sends the CSV to TaxPrep AU and processes it in memory. Use fictional data. Nothing is saved, classified as deductible or submitted to the ATO.

## Try the guided expense review

1. Click **Explore example summary** to load three fictional expenses.
2. Expect $792.60 entered, $312.60 recorded work portions and one item needing attention.
3. Edit the phone expense: $100 at 40% produces a $40 work portion. The combined total becomes $112.60.
4. Select **Partly reimbursed / not sure** to see an unresolved amount and a clearly labelled partial total.
5. Remove an expense, add a skipped category or restart. Cancel changes preserves the previous entry; restart/refresh clears everything.
6. Alternatively, choose **Try demo**, confirm sample income and answer each Yes/No question. **Use example details** speeds up each form.
7. Stop the API while requesting a summary. Entries remain editable; restart the API and click **Retry review**.

[Milestone 5](MILESTONE_5_EXPENSE_REVIEW.md) explains input bounds, rounding and the difference between work portions and tax eligibility.

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

After a Release backend build, run from `src/frontend`:

```powershell
npx playwright install chromium
npm run test:e2e
```

The script starts/stops its own API and Vite processes on 5087/5173 (stop your development servers first). It checks the guided expense interview, edits and partial totals, manual mobile entry, validation focus, real service interruption/retry and reset, plus the CSV upload regression flow. Desktop and 390px mobile widths are covered. It writes screenshots and a JSON report to ignored `test-results/browser/`. CI installs browser system dependencies and uploads these files alongside the API test report as a seven-day artifact.
