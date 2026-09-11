# Milestone 4 — Import API and automated tests

## Objective

Move CSV validation toward the ASP.NET Core boundary and protect the browser parser with automated tests before adding storage.

## Delivered

- `POST /api/transactions/import-preview` accepts one CSV file as multipart form data.
- The API rejects empty, non-CSV, and larger-than-1-MB files.
- The backend validates `date`, `description`, and `amount` fields.
- Valid rows, row-level errors, and the net total are returned together.
- Quoted CSV fields are handled by a standard .NET parser.
- Frontend parser tests cover valid rows, quoted commas, missing columns, invalid rows, and empty files.
- GitHub Actions runs the frontend tests on every pull request.

## Current boundary

The frontend preview remains local for now. This keeps the existing demo usable while the API contract is reviewed and tested. No transactions are persisted, logged, or connected to a real bank.

## Next increment

Connect the frontend upload form to the import-preview endpoint, add API integration tests, and show friendly network-error states.
