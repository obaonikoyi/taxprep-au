# Synthetic transaction data

`transactions.csv` contains 20 completely fictional transactions for developing and testing the TaxPrep AU import workflow.

## What each column means

| Column | Meaning | Example |
|---|---|---|
| `date` | The fictional transaction date in `YYYY-MM-DD` format | `2026-07-02` |
| `description` | A made-up merchant or payment description | `Harbour Office Supplies` |
| `amount` | The fictional transaction value in Australian dollars | `-49.95` |

## Amount rule

- A **negative amount** represents money leaving the account, such as a purchase.
- A **positive amount** represents money entering the account, such as fictional pay or a reimbursement.

This signed-number rule gives the future importer one predictable way to distinguish outgoing and incoming transactions.

## Why one description contains a comma

`"City Stationery, Adelaide"` is deliberately wrapped in double quotes. CSV uses commas to separate columns, so a description containing a comma must be quoted. This gives the future importer a useful parsing test.

## Safety rule

Every merchant, employer, date and amount in this file is synthetic. Do not replace this sample with a real bank export, receipt, account number, Tax File Number or personal financial record.

The entries are not claims that any expense is tax deductible. Future categorisation features must require user review and confirmation.
