# Milestone 16C-3 — encrypted local preparation backup and restore

Status: published for [issue #60](https://github.com/obaonikoyi/taxprep-au/issues/60), under parent [#37](https://github.com/obaonikoyi/taxprep-au/issues/37).

## User outcome

Allow a user to keep and later restore the **year-end preparation layer** without introducing Xoba Paycheck cloud storage, browser persistence or a document vault.

The user explicitly downloads one encrypted JSON file, keeps it themselves, reloads the matching financial-year reconciliation later, explicitly imports the encrypted file, enters the passphrase locally, reviews the decrypted candidate and chooses **Restore preparation answers**.

Nothing is restored before that final action.

## What the backup contains

- financial year;
- deterministic SHA-256 fingerprint of the loaded checked-pay + annual-source reconciliation;
- optional bank-deposit check answers and notes;
- expense/evidence coverage answers;
- applied Milestone 16C-2 privacy-bounded handoff summaries/source hashes;
- backup/payload versions and creation timestamp.

## What it deliberately excludes

- raw payslip PDFs or extracted text;
- raw annual-income-statement files or extracted text;
- raw bank transactions or merchant descriptions;
- receipt images or OCR text;
- TFNs or bank account identifiers;
- tax/refund/final-tax results;
- approved deductions;
- account/cloud credentials.

The reconciliation fingerprint is one-way SHA-256 over bounded relevant reconciliation facts. The backup stores the fingerprint, not those reconciliation facts.

## Encryption

Version: `taxprep-year-end-preparation-backup-v1`.

Payload version: `taxprep-year-end-preparation-payload-v1`.

The browser uses WebCrypto only:

- PBKDF2;
- SHA-256;
- 210,000 iterations;
- random 16-byte salt;
- AES-256-GCM;
- random 12-byte IV;
- authenticated ciphertext.

The passphrase:

- must be at least 12 characters;
- never leaves the browser tab;
- is not written to localStorage/sessionStorage;
- is not sent to the Xoba Paycheck API;
- is not included in the backup;
- is not recoverable by Xoba Paycheck.

A forgotten passphrase means the encrypted file cannot be restored.

## Restore gate

A selected encrypted file is not a restore.

Xoba Paycheck first checks the encrypted envelope. After the user provides the passphrase, decryption must authenticate successfully and the plaintext payload must pass bounded schema validation.

Xoba Paycheck then requires:

1. matching financial year; and
2. exact matching reconciliation fingerprint.

A backup made from different checked payslips, different annual sources, different annual-source status/review state or a different annual-source coverage answer is rejected.

Only after a matching payload is shown as a candidate can the user choose **Restore preparation answers**.

## What restore changes

Restore replaces only:

- the year-end hub's preparation answers; and
- its applied 16C-2 handoff summaries.

It does not import or replace payslips, annual income statements, statement transactions, evidence files or tax-rule results.

The user must load the matching income reconciliation separately first.

## Persistence boundary

The default app remains session-only.

Milestone 16C-3 does **not** use:

- localStorage;
- sessionStorage;
- IndexedDB;
- cookies for workspace storage;
- the Xoba Paycheck API;
- a server-side database;
- object storage;
- an external model.

The downloaded encrypted file is user-controlled portability, not Xoba Paycheck persistence.

Future account-based save/resume remains blocked on explicit decisions for server storage, encryption/key management, retention, deletion coverage, backups and account recovery.

## Verification target

Automated checks cover:

- real WebCrypto encrypt/decrypt round trip;
- encrypted JSON not exposing user notes/employer/file/raw-source text;
- wrong passphrase rejection;
- modified authenticated ciphertext rejection;
- financial-year mismatch rejection;
- reconciliation-fingerprint mismatch rejection;
- passphrase-length enforcement;
- bounded answer/handoff validation;
- React candidate-before-restore behavior;
- passphrase-confirmation mismatch;
- real Chromium encrypted download;
- proof that plaintext preparation notes are absent from the downloaded file;
- wrong-passphrase browser failure;
- current answers remaining unchanged before explicit restore;
- successful restore of preparation answers and applied handoffs;
- 390px mobile layout;
- existing no-document-upload/no-model-request monitoring.

Feature [PR #61](https://github.com/obaonikoyi/taxprep-au/pull/61) merged as `ac1f933f08ac75fa1be8ab09a352b2e7b1687ac3`. Feature CI run `35506501056` passed frontend lint/tests/build, backend/API plus browser smoke, and the production-container visitor journey.

Railway feature deployment `7c6ea1ba-15ef-449e-90ae-727d79e30757` reached **SUCCESS** for that exact merge commit at the existing standalone URL. This publication record triggers the dedicated public hosted-browser workflow; final live evidence is recorded in issue #60. The portfolio website remains unchanged.
