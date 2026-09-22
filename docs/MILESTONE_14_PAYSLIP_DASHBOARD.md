# Milestone 14 — payslip dashboard

Tracking: [#35](https://github.com/obaonikoyi/taxprep-au/issues/35). The new default workspace helps people understand actual pay throughout the year. The statement, document-intake and expense workspaces remain accessible.

## Try the result

1. Choose **Try example payslips**. Six fictional PDFs are read by the real PDF.js pipeline. Only shipped example records are pre-reviewed.
2. See $10,450 gross earnings, $8,815 take-home pay and $1,555 withheld (14.9% of gross). These are invented amounts, not tax-table examples.
3. Super totals $1,110 from 5 of 6 records. Missing super is unknown; the graph breaks where a group is incomplete.
4. In **View summary**, filter by employer/year, choose **Pay / Tax / Super** and switch monthly or payday charts. Open the exact data table for accessible numeric values.
5. Open **Check figures**, choose a payslip card and edit a field. It immediately leaves totals until valid figures are confirmed again. Original values remain visible.
6. Download the pay report, or choose **Use my own payslips** and upload supported PDFs / enter figures manually. User records always begin unconfirmed.
7. Export before refreshing or switching workspaces: the session is not persisted.

## Usability update — issue #40

The dashboard uses three reversible steps: **Add payslips → Check figures → View summary**. Moving between these steps preserves tab-local history. Switching to another tool still clears it. Tool navigation explains each area: **My pay**, **Bank spending**, **Tax documents**, **Guided example**.

Own uploads/manual entries open directly in review. Each confirmation selects the next unchecked payslip or opens the summary. Cards replace the wide review table on mobile. Forms group dates and amounts, explain payroll terms and keep source text available near the fields. Required empty fields remain empty. Invalid figures cannot be confirmed.

Summary cards are absent until there are checked records in the selected view, avoiding misleading zero totals. Pending records have a direct review action. The summary explains gross − withholding − other deductions = net. A single larger chart switches between Pay / Tax / Super, with currency axes, readable dates, an exact-value table and explicit missing-super gaps. Filter combinations with no records offer a reset. Clear history requires confirmation; example-to-own-data reset is immediate because the example is fictional.

This is an interface improvement to Milestone 14, not the start of Milestone 15. No calculation or input-compatibility expansion. Browser verification covers each step, automatic batch progression, history retention between steps, corrections, filters, export, clearing and narrow mobile screens. Release evidence is tracked in [issue #40](https://github.com/obaonikoyi/taxprep-au/issues/40).

## Supported input contract

- 1–20 PDFs per batch, 1 byte–2 MB per file, names no longer than 180 characters. At most 100 records in a session.
- One native-text page per PDF. Scans, images, encrypted files, combined payslips and arbitrary payroll layouts are not promised. Reading cancels after 60 seconds; a failed batch adds nothing and preserves existing records.
- The first automatic layout is **PAYSLIP SUMMARY v1**, with a separate line for each exact label: `Employer:`, `Period start:`, `Period end:`, `Pay date:`, `Gross pay:`, `Tax withheld:`, `Other deductions:`, `Net pay:`, `Super recorded:`. The downloadable fictional PDF demonstrates it. This is a bounded summary layout, not a named real payroll-provider importer.
- Amounts are nonnegative AUD, at most $10 million, with no more than two decimal places; properly grouped commas and an optional dollar sign are accepted. Negative adjustments remain unsupported.
- Dates use YYYY-MM-DD or DD/MM/YYYY in the PDF and are normalised to ISO. Supported calendar range: 2000–2100. Periods must run forwards and cover no more than 63 days. Financial-year grouping uses the payment date; the period itself may cross a year boundary.
- Blank required figures remain missing. No default zero withholding or other deductions. Blank super is allowed and remains unknown. Zero is accepted only when explicitly entered/read.
- Duplicate labels reject the PDF. Exact current-period labels exclude `YTD gross pay:` and `YTD tax withheld:`; cumulative figures never enter totals.
- Manual entry is available for unsupported source formats. It carries an explicit manual-source label and makes no document-reading claim.

## Review and integrity

The model stores source name, SHA-256, page-one extracted text, original fields, corrected fields and confirmation state. No TFN, account or membership number is requested. Source text can contain sensitive content and is shown only as text in the local review. Raw PDF bytes are released after reading and source text is not embedded in reports.

Confirmation requires valid dates/amounts and exact integer-cent agreement: gross minus withheld minus other deductions equals net. A mismatch remains unresolved; users must not alter true values to make an unsupported pay structure fit. This arithmetic does not prove the gross amount is the correct taxable base, the withholding schedule was followed, super reached a fund, tax was remitted, or award wages were paid correctly.

Exact file hashes and normalised employer + period + pay-date identity reject repeated imports. An edited duplicate blocks both records from derived totals until corrected/removed. Overlapping periods and possible gaps are visible questions, not automatic deletion or invented income. Split/adjustment payslips sharing the same identity require manual resolution and are not silently combined.

Only confirmed, currently valid records enter charts and totals. Every field edit invalidates confirmation; originals remain immutable. Example and own-data sessions cannot be mixed. The sample load goes through the same parser and validation before explicitly marking only those known fictional records reviewed.

## Charts, observations and report

Employer/year filters apply to summary, charts, observations and confirmed export. The review list and outstanding-review section show all session records. Grouping uses payment dates/months, without averaging weekly and monthly periods together. Charts show the latest 24 groups; their exact-value table covers all selected groups. Lines connect records; missing periods are not inferred.

The withholding percentage is total withholding / gross, not a marginal rate or final annual liability. Super totals disclose coverage; incomplete chart groups have no value. Observations compare the latest two distinct pay dates per employer only when period lengths match, and explicitly avoid guessing why figures changed. Different periods, gaps and overlaps have separate messages.

Offline HTML escapes all entered text, has no scripts or remote resources, and includes selected confirmed figures, field corrections, source hashes, parser version and outstanding questions. No original PDF or full source text is embedded. Reports are not complete tax returns.

## Architecture and privacy

`features/payslips/payslip.ts`: pure monetary/date validation, confirmation, deduplication, selected totals and observations.

`payslipReader.ts`: bounded local PDF reading and exact labelled-field extraction. `PayslipDashboard.tsx`: batch/cancellation/session orchestration. `PayslipReview.tsx`: source review and corrections. `PayslipCharts.tsx`: accessible actual-history charts. `payslipReport.ts`: escaped offline report.

No external AI model, document POST, server persistence, localStorage or IndexedDB is added. PDF assets are hosted on the same origin. Unmounting the workspace aborts reading. Refresh/clear/workspace change releases the history. Existing explicit fictional-expense save/resume behaviour is separate.

## Verification and learning

Unit cases extract real PDF bytes with PDF.js and verify exact totals, YTD exclusion, unknown values, money/date boundaries, arithmetic mismatches, review invalidation, duplicate amendments, grouping, changes and escaped exports. `payslip-smoke.mjs` verifies the actual example and user-upload routes, manual entry, correction, duplicate/bad-batch preservation, filters, export, clear/refresh/workspace change, mobile overflow, console errors and local-only requests. It runs in production-container and live-hosted CI alongside existing journeys.

The sample generator uses ReportLab and embedded DejaVu fonts; committed JSON PDF fixtures let normal builds run without Python. All six samples are independently invented. The key engineering lesson is separating source facts, user confirmation, derived actuals and later tax interpretation.

## Follow-on milestones

[#36](https://github.com/obaonikoyi/taxprep-au/issues/36): confirmed profile, applicable-year withholding checks and year-end scenarios. [#37](https://github.com/obaonikoyi/taxprep-au/issues/37): reconcile income/expense evidence and year-end preparation. Qualified tax work in #21/#28 remains open; annual statement #30 is deferred. No portfolio-site change.

## Publication record

- Feature [PR #38](https://github.com/obaonikoyi/taxprep-au/pull/38), merged as `b6bee9459adcbd051eec5c8440b56a789773978a`.
- [Build run 35417827172](https://github.com/obaonikoyi/taxprep-au/actions/runs/35417827172): all frontend, backend/API and production-container jobs passed. Frontend: 296 tests across 19 files, lint and production build. Production browser artifact: `10576168210` (`production-verification`).
- The complete browser journey passed: six real sample PDFs, own-file confirmation, correction invalidation, duplicates, atomic failed batches, manual entry, employer/year/chart filters, scoped offline reports, clear/refresh/workspace changes, mobile layout and no external document/model requests. Desktop and mobile screenshots were inspected.
- Browser testing found two real integration problems: accessible labels changed after edits, and a rapid switch between lazy-loaded workspaces could preserve local history. Stable labels and distinct Suspense keys fixed them before publication.
- Railway feature deployment `3ac1ad23-fe68-4b80-adaf-50b074b8d750` reached `SUCCESS` on 19 September 2026. Standalone URL: [Xoba Paycheck](https://taxprep-au-production.up.railway.app).
- The publication PR updates `deployment.json` to run **Verify hosted demo** against that URL. The live run, downloadable evidence and final milestone closure are recorded in [issue #35](https://github.com/obaonikoyi/taxprep-au/issues/35). Merge the publication record and close the issue only after that live journey passes.

The owner's portfolio website is unchanged. Qualified tax review remains pending in #21/#28; this milestone does not add personal forecasts, broad payroll support or a tax-lodgment service.

### Usability publication

- Feature [PR #41](https://github.com/obaonikoyi/taxprep-au/pull/41), commit `3c8c9d4c237c9d85d4dfa7236b4f52328e730b81`, implements the guided interface requested before Milestone 15.
- [Build 35419335992](https://github.com/obaonikoyi/taxprep-au/actions/runs/35419335992): all frontend, backend/API and production-container checks passed, including 297 tests. Artifact `10577245714` contains the revised browser journey and inspected desktop/mobile screenshots.
- Railway UI deployment: `60a1d325-8897-4b44-b4a8-7cc488ffe5ab`. The deployment record triggers the public browser journey; live evidence and closure are recorded in [issue #40](https://github.com/obaonikoyi/taxprep-au/issues/40).
- Screenshot review identified small mobile axis labels and shared-CSS interference with card emphasis. Responsive SVG coordinates and scoped styles resolved these before release. The take-home figure is highlighted; PDF upload remains visibly secondary to manual entry while layout support is limited.
