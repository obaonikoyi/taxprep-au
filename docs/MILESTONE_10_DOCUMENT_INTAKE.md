# Milestone 10 — document intake and evidence matching

Issue: [#18](https://github.com/obaonikoyi/taxprep-au/issues/18). Product direction: [PRODUCT_DIRECTION.md](PRODUCT_DIRECTION.md).

## User outcome

A visitor selects 2025–26 and the fictional employee phone-service context, reads a bank CSV and receipt PDF/image, reviews the extracted facts, links the payment and receipt as one purchase, supplies missing work details, and downloads an evidence report. The existing guided expense demo remains available. The portfolio website is unchanged.

The sample documents go through the actual parser, PDF renderer and OCR engine. No canned extraction response is used. Public use remains fictional-data only. This is document preparation, not deduction assessment or a complete return.

## Implementation

- React lazily loads the document workspace, PDF.js and Tesseract.js when needed. All engine scripts, English trained data, fonts and supporting assets are copied from pinned npm packages at build time and served by this app. No CDN or model credentials are needed.
- CSV parsing, PDF rendering and image OCR happen in the browser. Files, page previews, extracted text and corrections are held in this tab's memory. They are not posted to an API, written to localStorage/IndexedDB, or sent to an external model. Tesseract's data cache is disabled. Ordinary static engine assets may be cached by the browser; these are not user documents.
- Clear, remove, refresh and unmount release session references. Workers/PDF tasks are terminated after each file and on cancellation. Reports explicitly downloaded by the user are separate local copies and cannot be deleted by clearing the workspace.
- Upload limits: six source files, 2 MB each; PNG/JPG up to 12 megapixels; PDF up to three pages; one English/AUD receipt per page; up to 100 transactions per CSV. Files process sequentially with progress, error/retry and a two-minute per-file cancellation limit. PDF pages/images scale to a maximum 1,800 pixels on the longest side.
- CSV requires exactly Date,Description,Amount. Dates accept ISO or DD/MM/YYYY; negative amounts mean spending. Invalid rows fail the whole file instead of silently omitting data.
- Receipt parser v1 extracts candidate merchant/description labels, dates and labelled totals from OCR. Multiple different candidate totals/dates and low overall OCR confidence remain unresolved. Unlabelled merchant/description layouts often need manual entry. OCR confidence does not establish that any field is correct; all records require human confirmation.
- SHA-256 identifies exact file repeats, even under another name. Every record retains file name, page/row, original facts, current facts and extracted text. OCR text is inert data and rendered with escaping.
- Candidate duplicates use equal amounts and either the same date or matching merchant within seven days. This deliberately flags some unrelated purchases for review. Linking requires a confirmed bank/receipt pair with matching merchant, amount and date. Ambiguous matches block both items from the reviewed total. Users can link, record distinct purchases, or exclude duplicates with a reason. Different legitimate payment/receipt dates remain unresolved; do not alter correct dates merely to force a link.
- Credits/refunds and out-of-year records remain visible and outside the reviewed spending total. Credits are not automatically offset. Changed match facts invalidate a link; changed facts invalidate earlier distinct-purchase decisions involving that record.
- Report includes corrected/original values, hashes/page/row references, source text, work-use questions, exclusions, unresolved items, processing time and import failures still awaiting resolution. Original image/PDF files are not embedded. Gross reviewed spending is not a deduction or refund and is not reduced for reimbursement/work use.

## Data handling and real-document gate

This design has no document storage service, accounts or cross-user document API to authorise. Each workspace is local to its browser tab; there is no server-held document accessible to another user. No external AI provider receives records. The browser and device remain part of the trust boundary, and this is not a security certification or a production document vault.

Before accepting real financial documents or adding server processing/storage, review the threat model, authentication/tenant isolation, encryption, access logging without document content, explicit retention/deletion, consent, provider terms/data handling and incident procedures. Do not reuse the older demo's save-progress localStorage mechanism for documents. Paid personalised tax assessment also requires the operating-model work in the product direction.

## Verification and evaluation

- `npm test`: extraction ambiguity, hostile text, CSV validity, monetary/date boundaries, duplicate matching, credit/out-of-year handling, correction invalidation and escaped reports, alongside prior frontend tests.
- Production container browser check: actual PDF/PNG/JPG OCR, known expected fields, unreadable receipt, malicious instructions, renamed repeated PDF, receipt/bank merge, duplicate exclusion, manual corrections, work answers, credit/out-of-year flags, download, deletion, reload, failure/retry, mobile width and network boundary.
- `test-results/hosted/document-evaluation.json` records expected/observed extracted values, correction count for known fixture fields, elapsed wall time, page errors and observed external/model requests. The HTML report records per-file processing latency.
- External model requests/cost: zero with this local OCR design. Hosting, static-asset bandwidth and device compute costs are not measured. Small synthetic fixtures do not establish field accuracy on real bank formats, faded photos or arbitrary receipt layouts. No public speed or accuracy claim is justified by this evaluation.
- CI checks the production static-file mappings and engine downloads through the deployed ASP.NET container. Existing API and guided-demo regressions continue to run.

## Known boundaries and next milestone

Only one receipt per page is supported, with bounded English/AUD input. Expense classification, deduction conclusions, income completeness, refund estimates, ATO retrieval and lodgment remain future work. Evidence with different legitimate dates, currencies, layouts or statement shapes may require unresolved/manual handling. Browser session state is deliberately ephemeral; exports preserve reviewed facts for handover.

Milestone 11 should add one professionally reviewed deduction category/year, a versioned ATO-source register, explicit applicability conditions, tested calculations, and unresolved outcomes where facts or scope are missing. Receipt extraction and deduction approval remain separate decisions.

Implementation references: [Tesseract.js API](https://github.com/naptha/tesseract.js/blob/master/docs/api.md), [local installation](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md), [PDF.js examples](https://mozilla.github.io/pdf.js/examples/).
