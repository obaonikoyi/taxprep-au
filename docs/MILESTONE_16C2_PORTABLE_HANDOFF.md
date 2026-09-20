# Milestone 16C-2 — portable cross-workspace year-end handoff

Status: published for [issue #57](https://github.com/obaonikoyi/taxprep-au/issues/57), under parent [#37](https://github.com/obaonikoyi/taxprep-au/issues/37).

## User outcome

Carry reviewed summary facts from **Bank spending** and **Tax documents** into the session-only year-end preparation hub without cloud persistence, raw transaction transfer or silent cross-workspace state.

The handoff is explicit:

1. review a source workspace;
2. download a small TaxPrep JSON handoff;
3. open the matching financial year in the year-end hub;
4. import the JSON;
5. review the candidate summary; and
6. choose **Apply imported coverage**.

Nothing changes before step 6.

## Handoff format

Version: `taxprep-year-end-handoff-v1`.

Maximum imported file size: 64 KB.

Every handoff carries:

- source workspace kind;
- financial year;
- generated-at time;
- deterministic handoff identity;
- original source SHA-256 references; and
- bounded coverage metrics.

The handoff is not a signed tax record. Source hashes help trace the summary back to locally reviewed files; they do not prove that a hand-edited JSON file is authoritative.

## Bank spending handoff

A statement handoff records only:

- selected date range;
- transaction count;
- explicitly reviewed transaction count;
- work-review transaction count;
- amount flagged for work review;
- uncategorised count;
- statement reconciliation flag; and
- one statement SHA-256.

It deliberately excludes:

- transaction descriptions;
- merchants;
- review notes;
- bank account/header identity;
- raw statement text; and
- employer/pay-deposit matching.

The selected range must sit inside one Australian financial year and inside the imported statement period.

## Tax documents handoff

An evidence handoff records only:

- evidence-record count;
- reconciled item count after receipt/bank linking;
- confirmed item count;
- items with receipt evidence;
- items with a work purpose;
- reviewed-spending amount;
- open-question count; and
- source SHA-256 references.

It deliberately excludes:

- merchant names;
- item descriptions;
- OCR text;
- source filenames;
- image previews;
- phone-assessment answers; and
- any approved deduction.

The current Tax documents prototype remains bounded to 2025–26. A 2025–26 handoff is rejected if the year-end hub is showing 2026–27.

## Explicit application

Imported JSON first becomes a candidate. The candidate shows its source type, financial year, coverage metrics and source hashes.

**Apply imported coverage** copies only bounded fields:

Bank spending may populate:
- bank-spending coverage;
- reviewed transaction count;
- work-review transaction count; and
- amount flagged for work review.

Tax documents may populate:
- receipt/evidence coverage;
- work-purpose coverage;
- receipt count; and
- work-purpose count.

Tax documents reviewed spending is shown in the handoff summary but is **not** copied into the work-review amount. This prevents silent addition/duplication between statement and evidence views of the same spending.

Applicable-rule review is never auto-completed. Qualified gates #21 and #28 remain separate.

## Duplicate and year controls

TaxPrep rejects:

- unsupported versions;
- malformed JSON;
- files over 64 KB;
- invalid financial years;
- invalid or repeated SHA-256 references;
- inconsistent/out-of-bound counts;
- wrong-year imports;
- repeated handoff identities; and
- same-workspace handoffs that reuse an already-applied source hash.

A statement summary and an evidence summary may reference different source types. Import never maps statement credits to an employer.

## Persistence boundary

This milestone adds no localStorage/sessionStorage/API persistence. The JSON file is created only when the user explicitly downloads it and imported only when the user explicitly selects it.

Cloud save/resume remains blocked on [the storage/retention design gate](YEAR_END_SAVE_RESUME_DESIGN.md).

## Verification target

Automated checks cover:

- schema/version/hash/count validation;
- malformed JSON;
- financial-year normalization and mismatch blocking;
- same-source duplicate blocking;
- privacy-bounded statement export;
- privacy-bounded evidence export;
- explicit candidate → apply behavior;
- evidence import not overwriting the statement work-review amount;
- rule-review coverage remaining untouched;
- combined handover retaining applied source hashes;
- actual Bank spending JSON download;
- actual Tax documents JSON download;
- actual year-end hub JSON import;
- 390px mobile layout; and
- existing no-upload/no-model-request request monitoring.

Feature [PR #58](https://github.com/obaonikoyi/taxprep-au/pull/58) merged as `0df42a381517f7dbc23cb2ea2367c2f4f599e933`. Feature CI run `35505779972` passed frontend lint/tests/build, backend/API plus browser smoke, and the production-container browser journey.

Railway feature deployment `e3e8e9b5-c9de-4935-87fd-95678b6001e4` reached **SUCCESS** for that exact merge commit at the existing standalone URL. This publication record triggers the dedicated public hosted-browser workflow; final live evidence is recorded in issue #57. Parent #37 remains open for safe save/resume and user validation. The portfolio website remains unchanged.
