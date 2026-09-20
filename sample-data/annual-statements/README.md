# Annual income statement fixtures

Milestone 16B starts with one deliberately narrow fictional format:

`ANNUAL INCOME STATEMENT v1`

Required labelled fields are:

- Employer
- Financial year
- Statement date
- Source reference
- Status
- Gross income
- Tax withheld

Known additional employment fields (allowances, lump sums, reportable fringe benefits, reportable employer super and other employment payments) are preserved as unresolved coverage when they contain a meaningful value. They are **not** folded into ordinary gross income.

Run `python generate.py` from this directory to create local synthetic fixtures:

- `supported-final.pdf` — native-text supported PDF.
- `supported-final.png` — supported image for local OCR.
- `ambiguous-gross.pdf` — repeated gross label; must fail extraction.
- `invalid-date.pdf` — impossible statement date; remains unresolved.
- `unsupported-extra.pdf` — non-zero allowance; source stays out of final reconciliation.
- `poor-ocr.png` — deliberately degraded image used to exercise OCR/review failure handling.

The committed `example.json` contains the supported fictional PDF as base64 for deterministic browser tests. No real taxpayer, TFN, payroll account or employer data is included.

This is not a claim of arbitrary ATO/myGov or employer statement compatibility. Other layouts use manual annual-source entry until explicitly documented and tested.
