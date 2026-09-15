# Milestone 6 — Preparation report and evidence checklist

## Outcome

A visitor can keep a copy of the expense review using **Download report (HTML)**, inspect **Preview report**, or choose **Print / save PDF**. The downloaded HTML opens offline and contains no external assets or scripts.

[Tracking issue #9](https://github.com/obaonikoyi/taxprep-au/issues/9).

## User stories delivered

1. Download the successful review currently on screen as a portable report.
2. Read the expense totals, work portions, evidence references and next actions without reopening TaxPrep AU.
3. Preview the report before printing or downloading.
4. Open the browser's print dialog for just the report, with an A4 print layout and PDF output where the browser supports it.
5. Export incomplete preparation honestly: unresolved work portions remain unknown and the subtotal is marked partial.
6. Edit an expense and get an updated export after the new review succeeds.

## What is in the report

- Sarah's fictional profile, occupation and financial year; generation timestamp labelled UTC.
- Amount entered, recorded/known work portions and attention count.
- Every recorded category, its amount, percentage, work portion and status.
- Evidence and missing-information actions, plus work-purpose and percentage-basis notes.
- Evidence status and a reference for locating records; no receipt files are attached.
- Preparation limitations and a reminder that downloaded copies do not change when the app is edited or reset.

Skipped categories, the separate CSV preview and a complete income/tax calculation are outside this report. The sample report has $792.60 entered, $312.60 recorded work portions and one item needing attention. Setting the sample phone reimbursement to uncertain leaves $72.60 in known work portions, with the phone amount shown as **Unresolved**.

## Format decision

HTML is the direct download. It preserves Unicode text, opens in a browser offline and needs no report service or additional production dependency. Its stylesheet includes responsive and A4 print rules. **Print / save PDF** invokes the browser's print dialog; the app does not directly download a PDF or claim that the user completed a save operation. PDF availability and print headers/footers depend on the browser/device.

The report is previewed in a sandboxed iframe with same-origin access and modal printing enabled; scripts and external resources are disabled. See [MDN: window.print](https://developer.mozilla.org/en-US/docs/Web/API/Window/print) and [MDN: iframe sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe) for the browser primitives.

## Data and calculation contract

There is no new endpoint. Export uses the successful `/api/expenses/review` response and the matching saved expense list.

`createPreparationReport(expenses, review, profile, generatedAt)` returns an immutable HTML string and a filename such as `taxprep-au-preparation-2025-26-2026-09-15.html`.

- Require a nonempty, matching review.
- Reconcile supplied per-item cent amounts and counts with the supplied totals before export.
- Copy the API's rounded work portions; never calculate them again in the report.
- Keep `null` work portions as Unresolved. Fully reimbursed/zero-work items remain $0 with their explanation.
- Preserve missing-evidence actions even when their arithmetic amount appears in the total.
- Escape all variable text, including notes, profile fields and action text, before inserting it into the document.
- Include UTF-8 metadata and a restrictive content-security policy. The file has no scripts, links, remote images or fonts.

The summary is already remounted when its expense list changes. This removes the prior report while the next review loads. No export is offered for an empty list, pending review or failed review. A downloaded copy remains on the user's device after edits, restart or refresh.

## Controls and recovery

- Download uses a temporary Blob URL and removes the temporary anchor immediately. The URL is released after a 30-second grace period so the browser can consume it.
- Download failures show a retryable message and offer the print alternative.
- Printing is disabled until the expected report document is loaded. Clicking Print expands the preview before invoking the report frame. A print failure explains how to print the downloaded HTML instead.
- Status text says a download/print was requested; the browser controls the actual save dialog and destination.
- The expandable preview is keyboard accessible and the report iframe has an accessible title.

## Verification

- Report tests cover sample values, partial totals, cent rounding, snapshot consistency, text escaping, Unicode/newlines and temporary download URL cleanup.
- Component/journey tests cover print readiness, print/download failures, invalid report refusal, and unavailable exports after edits or failed/empty reviews.
- The real browser downloads the HTML and compares its bytes with the preview, then reopens it in an offline browser context with zero HTTP requests.
- Sample and long-note/partial reports are checked at desktop and 390px mobile widths. The browser check verifies that the app calls the report frame's native print method. A plain-page capability probe checks whether this browser emits `beforeprint`; when it does, the report must emit it too. Headless browsers may not expose native print dialogs/events, so the A4 rendering is checked separately through Chromium PDF output. The operating system save dialog still requires a user.
- Chromium generates A4 PDFs from those same downloaded reports for text extraction and visual inspection. CI artifacts contain HTML, PDFs, screenshots and the regression report.
- Existing API, expense-journey and CSV tests continue to run.

## Next milestone

Connect selected CSV transactions to editable expense records, allowing a visitor to move from imported transactions through evidence review to this report. Category selection and confirmation must remain explicit; importing a transaction must not imply tax eligibility.
