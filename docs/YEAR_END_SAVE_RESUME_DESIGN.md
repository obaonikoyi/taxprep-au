# Year-end save/resume design gate

Status: design gate only. No save/resume implementation is authorised by this document.

TaxPrep year-end preparation can contain pay history, annual income-source facts, bank checks and expense/evidence summaries. These are sensitive financial records and must not be persisted simply for convenience.

## Decisions required before implementation

### Storage location
- Decide whether derived facts are stored locally, in a TaxPrep account, or both.
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