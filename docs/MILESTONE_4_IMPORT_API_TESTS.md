# Milestone 4 — Connected CSV import preview

## Outcome and user story

As a portfolio visitor, I can try a fictional transaction file, see valid rows and precise errors, and recover from an unavailable server without losing my selected file. This completes the work in PR #5 and issue #6.

## Acceptance criteria

- Sample button submits the repository's 20 fictional rows to the real API; expected net total: AUD 1,374.12.
- File input supports one UTF-8 CSV up to and including 1,000,000 bytes.
- Loading disables repeat submission; cancel, clear, retry and 15-second timeout work.
- Replacing a file cancels the old request and ignores stale responses.
- Errors identify malformed records without discarding independent valid rows.
- File-wide faults (headers or row limit) return no preview rows.
- The backend is the single parser; TypeScript validates the response shape at the network boundary.
- API integration tests and frontend component/contract tests run in GitHub Actions.
- Desktop/mobile verification uses the real running API, including server failure and recovery.

## Supported CSV

Required unique headings `date`, `description`, `amount` are case insensitive and may be reordered. Additional unique columns are ignored, but every record must match the header's column count. UTF-8 BOM, CRLF, blank lines, quoted commas, escaped quotes and quoted multiline descriptions are supported.

Dates must be real calendar dates in `YYYY-MM-DD` form. Descriptions must contain 1–500 trimmed characters. Amounts are signed decimals with up to two fractional digits and magnitude at most 1,000,000,000. Currency symbols, thousands separators and exponent notation are rejected. Positive means incoming; negative means outgoing. File limit: 5,000 data records (invalid records count toward it). Row numbers refer to physical source lines; multiline records use their starting line.

## API contract

`POST /api/transactions/import-preview` with multipart form field `file` (one CSV, no extra form fields).

```json
{
  "transactions": [{"rowNumber": 2, "date": "2026-07-02", "description": "Example", "amount": -49.95}],
  "errors": [{"rowNumber": 3, "message": "Enter a valid date in YYYY-MM-DD format."}],
  "netTotal": -49.95
}
```

- `200`: validation result, including file/row errors; `rowNumber: null` denotes file-wide problems.
- `400`: empty file, unsupported encoding/extension, missing/multiple file, or malformed multipart upload.
- `413`: file or request exceeds the size limit. Total request limit: 1,100,000 bytes to allow multipart overhead. A malformed multipart section that exceeds the form limit may return `400`.
- Errors use a short `{ "message": "..." }` response. Proxy/server failures may not return JSON; the UI still shows a retry message.
- Responses carry `Cache-Control: no-store`. Decimal summation occurs in C#; invalid rows never affect the total.

## Data handling and design decisions

Uploads are sent to TaxPrep AU, buffered and processed in bounded memory, and discarded after preview. No database, file persistence, transaction-body logging, localStorage or external bank/ATO calls. A memory-buffer threshold above the request limit avoids normal multipart buffering to temporary disk. See [Microsoft upload documentation](https://learn.microsoft.com/en-us/aspnet/core/mvc/models/file-uploads?view=aspnetcore-8.0) for the framework's buffering behavior.

The unauthenticated preview endpoint is stateless; antiforgery is disabled deliberately. Adding cookie authentication or storage requires revisiting CSRF protection. Production hosting must provide HTTPS and route `/api` to ASP.NET Core; this milestone does not configure a public deployment.

## Validation

Run the commands in [DEVELOPMENT.md](DEVELOPMENT.md). Frontend tests cover multipart submission, response contracts, file limits, row errors, retry, cancellation, stale responses and timeout. API integration tests cover sample data, dates, amounts, quotation handling, headers, encodings, sizes, multipart shape and decimal totals.

## Next milestone

Expense entry and evidence assessment: amounts, work-use percentages, reimbursement/evidence checks, and a preparation total in Sarah's guided demo. CSV storage, bank-specific importers and final tax/refund calculations are future increments.
