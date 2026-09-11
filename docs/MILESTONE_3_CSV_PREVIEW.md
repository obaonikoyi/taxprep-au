# Milestone 3 — CSV transaction preview

## Objective

Turn the existing file-selection control into a safe, useful transaction preview using fictional CSV data.

## User story

> As a user, I want to inspect transactions from a CSV file before saving them so that I can catch formatting problems and confirm the imported values.

## Included

- Read CSV files locally in the browser.
- Require `date`, `description`, and `amount` columns.
- Support quoted descriptions containing commas.
- Validate dates, descriptions, and numeric amounts.
- Reject files larger than 1 MB.
- Display valid rows in a responsive preview table.
- Show row-level validation errors without discarding other valid rows.
- Display the net total using Australian currency formatting.

## Privacy boundary

This milestone does not upload or persist transactions. Processing happens in browser memory and the page clearly tells the user that the preview is not stored.

During development, only the fictional file in `sample-data/transactions.csv` should be used.

## Acceptance criteria

- The supplied fictional CSV produces a 20-row preview.
- A description containing a comma remains one value.
- Invalid rows show actionable row numbers and messages.
- Valid rows remain visible when another row is invalid.
- Income and expense amounts are visually distinguishable.
- The frontend lint and production build pass.

## Next increment

Send confirmed rows to an ASP.NET Core import-preview endpoint, move validation into a shared API contract, and add automated parser and endpoint tests.
