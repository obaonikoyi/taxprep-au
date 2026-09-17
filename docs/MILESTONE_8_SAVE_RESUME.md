# Milestone 8 — Save and resume preparation progress

## Outcome

A visitor can explicitly save a fictional preparation session in the same browser, close the page, and resume later. Completed expense records and unfinished form text are preserved separately. Resumed summaries always request a fresh API review.

[Tracking issue #13](https://github.com/obaonikoyi/taxprep-au/issues/13).

## User stories

1. Save the current interview step, recorded expenses and unfinished form entries.
2. Return after refresh or reopening the page and choose **Resume saved progress**.
3. Keep selected CSV source references, including a draft not yet saved as an expense.
4. See which changes are saved and which need another explicit save.
5. Delete the browser copy while keeping the current tab's entries.
6. Restart the demo and clear both the current session and its saved copy.
7. Recover from invalid saved data, unavailable/full storage or another tab changing the copy.

## Try it

1. Choose **Try demo**, confirm income and answer Yes to transport fares.
2. Enter `12.` in the amount and start a note. Leave the remaining fields unfinished.
3. Click **Save progress**, then refresh the page.
4. Choose **Resume saved progress**. The incomplete amount and note return to the same form.
5. **Save expense** still requires a valid amount, work-use percentage, reimbursement and evidence answers.
6. Complete an expense, review the summary and click **Save progress** again to save those later changes.
7. Delete the saved progress: current entries remain. **Restart demo** also removes the entries and CSV preview.

For imported data, select a sample CSV row and open an expense draft before saving progress. The selected rows return after resume; the unselected CSV preview does not. Once the expense is committed, importing the same CSV again still marks its saved source rows unavailable.

## Storage contract

- One snapshot under the localStorage key `taxprep-au:preparation-progress`.
- Explicit button-driven saving; no automatic save or writes during initial loading, typing, page close or storage events.
- Version `1`, financial year `2025-26`, ISO UTC save timestamp, and a `data` object containing `expenses` and `step`.
- The step can hold bounded raw form strings and a selected-source draft. Invalid number text can be saved as unfinished text, but cannot become a committed expense without form validation.
- At most three category records, 50 source rows per record/draft, the existing field limits, and a maximum snapshot length of 1,000,000 characters.
- CSV files, unselected previews, checkbox selections, API responses, calculated totals, generated reports and identity/account details are not persisted.
- The original source references remain in the browser copy. Expense review still sends only the existing API fields.

Storage belongs to this browser profile and origin. It is not encrypted by the app, backed up, synchronised to another device or associated with an account. Private browsing, clearing site data, browser eviction or moving to another origin can remove or hide the copy. This remains a fictional-data portfolio demo.

## Restore and validation

`progressStorage.ts` treats stored JSON as untrusted input. It validates the version, year, timestamp, expense types, amounts, character limits, categories and navigation indexes. Source rows must have real dates within the demo year, supported negative amounts, bounded metadata and keys matching their original transaction content/occurrence. Source keys cannot be reused across saved records or a pending imported draft.

The reader constructs a fresh object using only supported fields. Unknown cached report/API properties are discarded. Malformed, incompatible and oversized copies remain untouched until explicitly deleted; loading does not silently reset or overwrite them.

Resume is explicit and replaces the current tab's entries with the saved copy. The journey and upload components are remounted, so an old request, file preview, form or export cannot survive the restore. A summary requests `/api/expenses/review` again. If the service is unavailable, the entries remain editable and the user can retry; no cached total or report is offered.

## Failures and multiple tabs

The controls catch read, write and removal failures and retain current in-memory work. A failed write leaves the previous snapshot in place. Restart only clears the current session after removing its stored copy successfully; a failure is visible and retryable.

Before save, resume or delete, the hook rereads the stored copy and compares it with the expected/displayed version. A changed copy is offered for review instead of being silently overwritten. Native `storage` events also announce changes from another tab without replacing current entries. Deleting a copy in one tab never causes automatic recreation in another.

This is best-effort conflict detection, not a transactional lock: localStorage has no atomic compare-and-swap across tabs. Use one tab for editing. Accounts, server-side revisions and stronger concurrency control would belong to a later persistence design.

## Learning notes

- **Draft versus committed data:** `12.` is valid unfinished text, but not a valid saved expense amount.
- **Runtime validation:** TypeScript cannot guarantee what another script or an older app version put in localStorage.
- **Minimal snapshots:** save the entered facts and recalculate results on resume.
- **State ownership:** the form reports draft changes to the journey; typing must not refocus the screen heading.
- **Explicit operations:** the app can truthfully show saved/unsaved state and make storage failures recoverable.

## Verification

- Snapshot tests cover valid records, incomplete/imported drafts, source identities, schema/year limits, duplicate data, malformed/oversized copies and blocked reads.
- Journey tests cover explicit saves, refresh-style remounts, focus, cancelling a resumed edit, quota failures/retry, blocked storage, stale writes/deletes, storage events and failed restart recovery.
- Browser checks use real localStorage, page reloads and new pages in the same browser context. They cover manual and imported drafts, restored duplicate protection, two-tab updates/deletion, corrupt-copy recovery, mobile layout, a real API outage on resume, retry and a fresh report preview.
- Existing CSV, expense and report tests remain in CI. Browser screenshots and the regression report are uploaded as verification artifacts.

## Next milestone

Publish a hosted portfolio demo with frontend/API hosting, a short walkthrough and checks that a visitor can complete the sample journey from a shared link.
