# Year-end save/resume design gate

Status: design gate only. No save/resume implementation is authorised by this document.

Xoba Paycheck year-end preparation can contain pay history, annual income-source facts, bank checks and expense/evidence summaries. These are sensitive financial records and must not be persisted simply for convenience.

## Decisions required before implementation

### Storage location
- Decide whether derived facts are stored locally, in a Xoba Paycheck account, or both.
- Original PDFs/images must be separated from derived facts and must not be retained by default without an explicit product decision.

### Encryption
- Define encryption in transit and at rest for any server-side storage.
- Define how secrets/keys are managed and rotated.

### Retention
- Define a default retention period for derived tax-preparation facts.
- Define whether original financial files have a shorter or zero-retention default.
- Make the retention period visible to the user before storage begins.

### Deletion
- Provide a user-initiated delete action for a year/workspace.
- Define deletion coverage across primary storage, indexes, caches and backups.
- Explain any backup deletion delay rather than implying immediate physical erasure.

### Account recovery and access
- Define authentication and recovery before sensitive histories can be resumed across devices.
- Do not use a fictional/demo storage mechanism as a real document vault.

### Export and portability
- Users must be able to export the useful handover independently of cloud storage.
- A future saved workspace should record source versions and edits so resumed facts remain traceable.

## Current Milestone 16C-1 decision

Keep the preparation hub session-only. Do not write pay, bank, receipt or preparation answers to localStorage, sessionStorage or the API. The user can download the offline handover if they want to keep the result.

## Milestone 16C-2 interim portability

Before cloud save/resume exists, Xoba Paycheck may use an explicit downloaded/imported `taxprep-year-end-handoff-v1` JSON summary between local workspaces. This is not hidden persistence:

- the user must explicitly download the summary;
- the user must explicitly select it for import;
- the year-end hub validates its financial year and source hashes;
- the summary excludes raw bank transactions, merchant descriptions and OCR text; and
- applying imported coverage requires a separate confirmation action.

This portable summary does not change the storage, retention, deletion or account decisions required before real save/resume can be implemented.


## Milestone 16C-3 decision — user-controlled encrypted local backup

The first save/resume implementation may be an explicit **encrypted file download/import** for the year-end preparation layer only.

This does not authorise Xoba Paycheck cloud persistence or hidden browser persistence.

Allowed:

- preparation answers and applied privacy-bounded handoff summaries;
- deterministic fingerprint of the matching reconciliation;
- WebCrypto PBKDF2-SHA-256 + AES-GCM;
- user-supplied passphrase that is never stored or transmitted;
- explicit download, explicit import, explicit decrypt and explicit restore.

Not allowed in this milestone:

- raw financial documents or OCR text in the backup;
- raw transactions/descriptions in the backup;
- localStorage/sessionStorage/IndexedDB workspace persistence;
- Xoba Paycheck API/database/object-storage persistence;
- passphrase recovery service;
- restore onto a different financial year or reconciliation fingerprint.

This user-controlled encrypted file does not resolve the remaining design requirements for future account-based storage, retention/deletion, server-side key management, backup deletion delay or account recovery.
