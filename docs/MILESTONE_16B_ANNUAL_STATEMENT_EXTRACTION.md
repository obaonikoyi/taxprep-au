# Milestone 16B — local annual income-statement extraction

Status: published for [issue #30](https://github.com/obaonikoyi/taxprep-au/issues/30), feeding the published [Milestone 16A](MILESTONE_16A_INCOME_RECONCILIATION.md) reconciliation model.

## User outcome

A user with checked payslips can upload one supported annual income statement, review every extracted value, correct anything that is wrong, and explicitly confirm it before the source enters year-end reconciliation.

Extraction is an input convenience. It does not turn document text into a tax conclusion.

## First supported format

The first deliberately narrow format is:

`ANNUAL INCOME STATEMENT v1`

Required exact labels:

- `Employer:`
- `Financial year:`
- `Statement date:`
- `Source reference:`
- `Status:`
- `Gross income:`
- `Tax withheld:`

Supported status wording maps to the existing annual-source states:

- Tax ready / final / finalised → final;
- Not final / Not tax ready → provisional;
- Unsure / unknown → unsure.

Other employer, myGov or payroll layouts are **not** claimed to be supported. They keep the existing manual-entry fallback.

## Local reader

Supported files:

- one-page native-text PDF;
- one-page image-only PDF using local OCR;
- PNG;
- JPG/JPEG.

Limits:

- 2 MB per file;
- filename up to 180 characters;
- images up to 12 megapixels;
- one statement per PDF.

The browser calculates SHA-256 from the source bytes. PDF.js and Tesseract run locally in the tab. The document is not uploaded to the Xoba Paycheck API or an external model.

Parser version: `annual-income-statement-v1`.

## Review before transfer

Reading a file creates a **candidate**, not an annual income source.

The review screen shows:

- source filename, page and SHA-256;
- employer/payer;
- financial year;
- statement date;
- source reference;
- final status;
- gross income;
- tax withheld;
- suggested pay-history employer link; and
- extracted source text.

The user may correct values. Corrections preserve the original extraction beside the current value.

The **Confirm and add annual source** button stays disabled until:

1. required facts pass deterministic validation; and
2. the user checks **I checked these extracted values against the annual source.**

Discarding the candidate transfers nothing.

## Missing and ambiguous facts

Xoba Paycheck does not guess missing values.

Examples:

- blank withholding is unresolved, not zero;
- an impossible statement date remains unresolved;
- the wrong financial year blocks transfer for the selected year;
- repeated labelled values such as two Gross income fields reject the layout as ambiguous;
- an unknown status remains unresolved.

## Additional employment fields

The documented fictional format also recognises these labels:

- Allowances;
- Lump sums;
- Reportable fringe benefits;
- Reportable employer super; and
- Other employment payments.

Zero / none / nil values do not create a blocker.

A meaningful value is retained as **unresolved coverage**. It is never folded into ordinary gross income automatically. After transfer, the annual source stays excluded from final reconciliation until that additional field is supported or separately reviewed.

## Provenance and edits after transfer

Imported annual sources carry:

- document filename;
- SHA-256;
- page;
- parser version;
- complete extracted source text;
- original extracted values;
- corrected current values; and
- unresolved extra fields.

If a document-origin source is edited after transfer, its `reviewed` state becomes false and it drops out of final reconciliation. The user must explicitly **Reconfirm imported source** before it can count again.

Exact repeated document hashes are treated as duplicates even if the user changes the source reference.

Reconciliation version becomes `year-end-pay-reconciliation-v2` for reports produced with this source/provenance model.

## Fictional fixtures

[Fixture contract](../sample-data/annual-statements/README.md) and `generate.py` define reproducible synthetic cases:

- supported native-text PDF;
- supported PNG;
- ambiguous repeated gross field;
- invalid date;
- unsupported non-zero allowance; and
- deliberately poor OCR image.

The committed `example.json` contains only fictional data and powers the actual browser PDF → review → reconciliation path.

## Export

The year-end pay handover now records imported source provenance, including original vs corrected extraction and escaped extracted source text. Raw source files are not embedded.

The handover still keeps checked payslips and final annual employment sources as two views of the same employment income. They are never added together as separate income.

## Tax and operating-model boundary

This milestone does not:

- unlock a refund, debt or final-tax result;
- approve a deduction;
- establish legal correctness when annual and payslip figures differ;
- connect to ATO/myGov;
- persist documents;
- add accounts/authentication; or
- change the portfolio website.

Qualified review in #21/#28 and real-user/paid-service data-handling requirements remain separate gates.

## Verification target

Automated verification covers:

- parsing the real fictional PDF fixture;
- unsupported and ambiguous layouts;
- blank withholding, wrong year and invalid date;
- unsupported additional fields;
- original/corrected provenance;
- edited imported-source reconfirmation;
- repeated document hashes;
- escaped hostile extracted text in export;
- React explicit-confirmation behavior;
- real browser PDF → review → transfer → reconciliation → correction → reconfirmation → export;
- 390px mobile overflow;
- existing no-document-upload/no-model-request monitoring.

Feature [PR #52](https://github.com/obaonikoyi/taxprep-au/pull/52) merged as `5b72ac6d763d7e7b57cb716743c259602188432c`. Feature CI run `35486688336` passed frontend lint/tests/build, backend/API plus browser smoke, and the production-container browser journey.

Railway feature deployment `ee0431c2-782c-4a79-abbc-c11fd4e41763` reached **SUCCESS** for that exact merge commit at the existing standalone URL. This publication record triggers the dedicated public hosted-browser workflow; final live evidence is recorded in issue #30. The portfolio website remains unchanged.
