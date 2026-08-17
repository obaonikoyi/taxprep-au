# TaxPrep AU — Project Plan

## 1. Document Purpose

This document turns the TaxPrep AU product idea into an actionable software-development plan. It defines the work required for Version 1 (V1), the boundaries of the project, delivery stages, quality expectations, and the decisions that must be made before implementation.

This plan contains product and engineering information only. Real tax records, bank transactions, receipts, tax identifiers, and other personal financial information must never be committed to this repository.

## 2. Project Overview

TaxPrep AU is an Australian tax-preparation assistant for individual taxpayers. It will help users import transaction records, review possible work-related expenses, track supporting evidence, and generate an organised preparation summary.

TaxPrep AU supports preparation only. It will not lodge tax returns, replace myTax, act as a registered tax agent, or provide personalised tax, legal, or financial advice.

## 3. Problem Statement

Preparing an individual tax return can require a person to search through bank statements, receipts, invoices, and notes stored in different places. Generic spreadsheets can hold this information, but they do not guide users through reviewing transactions, recording evidence, resolving uncertainty, and preparing a consistent summary.

This creates several problems:

- relevant transactions can be overlooked;
- personal and work-related spending can be mixed together;
- supporting evidence may be missing or difficult to locate;
- users may not know which items need further review;
- repeated manual sorting takes time; and
- information may not be ready for myTax or a tax-agent discussion.

TaxPrep AU will provide a structured, plain-language preparation workflow while keeping the user responsible for every final decision.

## 4. Project Objectives

V1 should:

1. reduce the manual effort required to organise transaction records;
2. help users consistently review and categorise transactions;
3. make missing evidence and incomplete information visible;
4. require users to confirm suggestions rather than accepting them automatically;
5. produce a useful preparation summary; and
6. demonstrate professional full-stack software-development practices.

## 5. Target Users

The primary V1 user is an Australian individual taxpayer who:

- earns salary or wage income;
- may have income from more than one employer;
- wants to organise possible work-related expenses;
- has transaction data and receipts to review; and
- plans to use myTax or consult a registered tax agent.

Businesses, tax practices, companies, trusts, partnerships, and self-managed super funds are not target users for V1.

## 6. Product Principles

- **Preparation, not lodgement:** The product organises information but does not submit a return.
- **User confirmation:** A suggestion is never treated as a final tax decision.
- **Plain language:** Instructions and explanations should be easy to understand.
- **Evidence first:** Users should be prompted to record supporting evidence and a work-related purpose.
- **Privacy by design:** The application should collect and retain only necessary information.
- **Transparent uncertainty:** Uncertain items should be clearly flagged for review.
- **Australian focus:** The workflow should reflect the Australian individual-tax context.
- **Safe test data:** Development and demonstrations must use fictional or properly anonymised data.

## 7. V1 Deliverables

### 7.1 Tax-year workspace

Users can:

- create a workspace for an Australian financial year;
- view the workspace status and preparation progress; and
- delete a workspace and its stored data.

### 7.2 CSV transaction import

Users can:

- upload a supported CSV file;
- map or confirm required columns;
- preview transactions before import;
- see clear validation errors;
- reject invalid rows or correct them; and
- avoid obvious duplicate imports.

### 7.3 Transaction review

Users can:

- view imported transactions;
- search, sort, and filter them;
- edit descriptions and add notes;
- mark an entry as personal, income-related, potentially deductible, or needing review;
- exclude irrelevant entries; and
- split an entry where the V1 design supports it.

### 7.4 Expense categorisation

Users can:

- assign common work-expense categories;
- receive simple rule-based category suggestions;
- confirm or reject every suggestion;
- leave an item uncategorised; and
- add notes when an item is uncertain.

### 7.5 Evidence tracking

Users can:

- record whether evidence is available;
- attach or reference a receipt if file storage is included in the chosen architecture;
- describe the work-related purpose;
- see missing-evidence warnings; and
- identify incomplete entries.

### 7.6 Review guidance

The application can:

- ask plain-language review questions;
- show general educational explanations;
- identify mixed-use, uncertain, or incomplete entries;
- direct users to current official guidance where appropriate; and
- recommend professional advice when an item cannot be safely resolved.

### 7.7 Preparation summary

Users can:

- see confirmed totals grouped by category;
- see missing evidence and unresolved entries;
- review the information before export; and
- export a preparation report as CSV, PDF, or another format selected during technical design.

## 8. Explicit V1 Exclusions

V1 will not:

- lodge returns with the Australian Taxation Office;
- connect to ATO Online services or myGov;
- act as a registered tax agent;
- guarantee deductibility;
- calculate a final refund, tax debt, or legally binding tax position;
- provide personalised tax, legal, or financial advice;
- claim deductions without user confirmation;
- support business, company, trust, partnership, or SMSF returns;
- prepare BAS, GST, or payroll records;
- implement advanced cryptocurrency, capital gains, investment, rental-property, or foreign-tax calculations;
- support every bank statement format;
- connect directly to bank accounts through Open Banking;
- provide native iOS or Android applications;
- provide accounting-firm or multi-tenant workflows; or
- retain sensitive documents indefinitely without an approved retention policy.

## 9. Functional Requirements

| ID | Requirement | V1 priority |
|---|---|---|
| FR-01 | Create and delete a tax-year workspace | Must |
| FR-02 | Import a supported CSV transaction file | Must |
| FR-03 | Preview and validate data before import | Must |
| FR-04 | Detect obvious duplicate imports or rows | Must |
| FR-05 | Search, sort, and filter transactions | Must |
| FR-06 | Edit transaction details and notes | Must |
| FR-07 | Assign a review status and category | Must |
| FR-08 | Suggest categories using transparent rules | Should |
| FR-09 | Require confirmation of suggestions | Must |
| FR-10 | Record evidence status and work purpose | Must |
| FR-11 | Flag incomplete or uncertain entries | Must |
| FR-12 | Display totals grouped by category | Must |
| FR-13 | Export a preparation summary | Must |
| FR-14 | Attach receipt files | Could |
| FR-15 | Split a mixed transaction | Could |

“Must” items are required for V1. “Should” items are important but may be simplified. “Could” items may move to a later release if they threaten the core schedule.

## 10. Non-Functional Requirements

### 10.1 Security and privacy

- Do not store secrets in source control.
- Do not log uploaded financial records or receipt contents.
- Validate file type, structure, size, and content.
- Apply authentication and authorisation if user data is stored remotely.
- Encrypt sensitive data in transit and use appropriate storage protection.
- Provide deletion and retention behaviour that users can understand.
- Use fictional or anonymised fixtures in source code, tests, screenshots, and demonstrations.

### 10.2 Reliability

- A failed import must not create a partially corrupted workspace.
- Validation errors must identify the affected row or field.
- Totals must be deterministic and covered by automated tests.
- Exported values must match the reviewed workspace values.

### 10.3 Usability and accessibility

- Use plain language and clear calls to action.
- Support keyboard navigation for core workflows.
- Provide visible labels, focus states, and useful error messages.
- Use sufficient colour contrast.
- Do not rely on colour alone to communicate status.
- Test the workflow on common desktop and mobile browser sizes.

### 10.4 Maintainability

- Separate user-interface, business-rule, and data-access responsibilities.
- Keep category rules transparent and testable.
- Use consistent formatting, linting, and naming conventions.
- Document important technical decisions.
- Require automated checks before changes are merged.

### 10.5 Performance

- Define a realistic maximum CSV size during technical design.
- Keep search and filtering responsive for the agreed V1 dataset.
- Avoid loading receipt files or complete datasets unnecessarily.

## 11. Proposed User Journey

1. The user creates a financial-year workspace.
2. The user selects and previews a supported CSV file.
3. The application validates the file and reports problems.
4. Valid transactions are imported.
5. The user filters and reviews transactions.
6. The application suggests categories using simple, visible rules.
7. The user confirms, changes, or rejects each relevant suggestion.
8. The user records evidence and a work-related purpose.
9. Uncertain or incomplete items remain flagged.
10. The user reviews category totals.
11. The user exports a preparation summary.
12. The user uses the summary when working in myTax or speaking with a registered tax agent.

## 12. Technical Decisions to Confirm

No technology choice is considered final until it is recorded in an architecture decision record.

The following decisions must be confirmed before the project foundation is built:

- front-end framework and language;
- back-end approach and API design;
- database and data model;
- local-only versus authenticated cloud storage;
- receipt storage approach;
- authentication provider, if required;
- CSV parsing and validation libraries;
- PDF or report-generation approach;
- hosting platform;
- automated testing tools;
- CI workflow; and
- monitoring and error-reporting approach.

Selection criteria should include learning value, cost, security, maintainability, Australian hosting or data-location considerations where relevant, and suitability for a portfolio project.

## 13. High-Level Data Model

The first data-model design should consider these entities:

- **User** — account identity if authentication is included.
- **TaxYearWorkspace** — one preparation workspace for one financial year.
- **ImportBatch** — source and status of a CSV import.
- **Transaction** — date, description, amount, review status, and import reference.
- **Category** — the assigned expense or income category.
- **EvidenceRecord** — evidence status, notes, and optional attachment reference.
- **ReviewFlag** — reason an item needs attention.
- **ExportRecord** — metadata for a generated summary.

Exact fields, relationships, retention rules, and sensitive-data classification will be defined during data design.

## 14. Delivery Plan

### Phase 1 — Discovery and requirements

**Purpose:** Confirm the problem, target user, V1 boundaries, and risks.

**Outputs:**

- approved project plan;
- prioritised V1 requirements;
- initial user stories;
- glossary of tax-preparation terms;
- research questions requiring official guidance; and
- initial risk register.

**Exit condition:** V1 is small enough to build and every major feature has a clear reason to exist.

### Phase 2 — UX and data design

**Purpose:** Design the workflow before implementation.

**Outputs:**

- user-flow diagram;
- low-fidelity wireframes;
- CSV import specification;
- initial data model;
- validation rules;
- privacy and data-retention notes; and
- accessibility checklist.

**Exit condition:** A user can walk through the planned flow without unresolved navigation gaps.

### Phase 3 — Technical foundation

**Purpose:** Establish a professional and testable codebase.

**Outputs:**

- selected technology stack;
- architecture decision records;
- application skeleton;
- local development instructions;
- environment-variable template without secrets;
- formatting and linting;
- test framework; and
- continuous-integration checks.

**Exit condition:** A new developer can run the project and all foundation checks pass.

### Phase 4 — Core transaction workflow

**Purpose:** Deliver the main value of the product.

**Outputs:**

- workspace creation;
- CSV preview and validation;
- safe transaction import;
- duplicate handling;
- transaction table;
- search, sort, and filters; and
- review status and category editing.

**Exit condition:** A user can import fictional sample data and complete a basic transaction review.

### Phase 5 — Evidence and guidance

**Purpose:** Help users complete and verify reviewed entries.

**Outputs:**

- evidence status;
- work-purpose notes;
- review flags;
- plain-language questions;
- category suggestions; and
- confirmation controls.

**Exit condition:** The product distinguishes confirmed, incomplete, and uncertain items.

### Phase 6 — Summary and export

**Purpose:** Produce the V1 output.

**Outputs:**

- category totals;
- unresolved-items list;
- evidence summary;
- final review screen; and
- downloadable preparation report.

**Exit condition:** Exported values match the reviewed workspace and pass automated tests.

### Phase 7 — Quality assurance and release

**Purpose:** Verify that V1 is safe, understandable, and demonstrable.

**Outputs:**

- automated test results;
- manual test checklist;
- accessibility review;
- security and privacy review;
- supported-browser check;
- known-limitations list;
- deployment instructions; and
- V1 release notes.

**Exit condition:** All must-have acceptance criteria pass, critical defects are resolved, and limitations are documented.

## 15. Initial Backlog

### Epic A — Workspace management

- Create a tax-year workspace.
- Display progress and status.
- Delete a workspace safely.

### Epic B — Import

- Define the supported CSV schema.
- Upload and parse a CSV file.
- Map columns.
- Preview valid and invalid rows.
- Prevent obvious duplicates.
- Confirm import.

### Epic C — Transaction review

- Display transactions.
- Search and filter.
- Edit notes and descriptions.
- Assign review states.
- Categorise and exclude entries.
- Handle mixed transactions if retained for V1.

### Epic D — Evidence

- Record evidence status.
- Add a work-purpose explanation.
- Add optional receipt references.
- Flag missing evidence.

### Epic E — Guidance

- Define transparent suggestion rules.
- Ask review questions.
- Confirm or reject suggestions.
- Show uncertainty and official-source links.

### Epic F — Reporting

- Calculate category totals.
- Show unresolved entries.
- Preview the preparation summary.
- Export and verify the report.

### Epic G — Quality and delivery

- Add automated tests.
- Add continuous integration.
- Complete accessibility checks.
- Perform privacy and security review.
- Deploy a demonstration using fictional data.

## 16. Testing Strategy

### Unit tests

Cover:

- CSV field validation;
- duplicate-detection rules;
- category-suggestion rules;
- transaction status changes;
- category totals; and
- export transformations.

### Integration tests

Cover:

- import-to-storage flow;
- workspace deletion;
- evidence and transaction relationships;
- authentication and authorisation if included; and
- report generation.

### End-to-end tests

Cover the primary journey:

1. create a workspace;
2. import a fictional CSV;
3. review and categorise entries;
4. record evidence;
5. resolve or retain flags; and
6. export the summary.

### Manual testing

Check:

- confusing or malformed CSV files;
- empty workspaces;
- duplicate uploads;
- large supported files;
- keyboard-only use;
- responsive layouts;
- clear errors; and
- deletion behaviour.

No test, demonstration, screenshot, fixture, or issue report should contain real personal financial information.

## 17. Initial Risks and Controls

| Risk | Impact | Planned control |
|---|---|---|
| Users treat suggestions as tax advice | High | Require confirmation, show disclaimers, and flag uncertainty |
| Sensitive data is exposed | High | Minimise collection, protect storage, redact logs, and use fictional test data |
| Tax guidance becomes outdated | High | Prefer current official sources, record review dates, and avoid definitive claims |
| CSV formats vary between banks | Medium | Support a defined format first and provide column mapping and validation |
| V1 becomes too large | High | Protect must-have scope and defer “Could” items |
| Incorrect totals or exports | High | Use deterministic calculations and automated reconciliation tests |
| Receipt storage adds security complexity | Medium | Make attachments optional until storage and retention are approved |
| Users assume ATO affiliation | Medium | Display a clear independence disclaimer |
| Portfolio deadlines encourage shortcuts | Medium | Use phased exit conditions and quality checks |

## 18. Privacy and Repository Rules

The repository may contain:

- application source code;
- Markdown documentation;
- fictional sample transactions;
- synthetic test receipts;
- test fixtures containing no real identities;
- database migrations; and
- technical decision records.

The repository must not contain:

- the original Word planning document;
- real names linked to financial records;
- Tax File Numbers or identity documents;
- bank account or card numbers;
- real bank statements or transaction exports;
- payslips, invoices, or receipts belonging to a real person;
- authentication secrets, API keys, or production credentials;
- completed tax returns; or
- private correspondence with the ATO or a tax agent.

Any accidental sensitive-data commit must be treated as a security incident. Removing the visible file alone may not remove it from Git history.

## 19. Definition of Done

A feature is done when:

- its acceptance criteria are met;
- relevant unit and integration tests pass;
- error and empty states are handled;
- keyboard and basic accessibility behaviour are checked;
- no sensitive information or secrets are committed;
- documentation is updated;
- code formatting and automated checks pass; and
- a reviewer can understand the user impact.

V1 is done when:

- every must-have functional requirement is complete;
- the main end-to-end journey passes;
- totals and exports are verified;
- privacy and security controls are reviewed;
- critical and high-severity defects are resolved;
- known limitations are documented; and
- the deployed demonstration uses fictional data only.

## 20. V1 Success Measures

V1 should allow a test user to:

- import the supported sample CSV without manually recreating each row;
- review and categorise all imported transactions;
- identify every entry missing evidence or requiring review;
- see totals and unresolved items clearly;
- export a useful preparation summary; and
- understand that the product supports preparation rather than tax advice or lodgement.

During usability testing, record completion time, validation failures, unclear steps, corrections, and user feedback. Define numeric targets after the first prototype provides a realistic baseline.

## 21. Immediate Next Steps

1. Review and approve this project plan.
2. Convert V1 deliverables into small user stories with acceptance criteria.
3. Define the supported CSV format using fictional data.
4. Create the primary user-flow diagram.
5. Produce low-fidelity wireframes.
6. Compare suitable technology-stack options.
7. Record the selected architecture in decision documents.
8. Build the technical foundation only after those decisions are confirmed.

## 22. Disclaimer

TaxPrep AU is an independent software project and is not affiliated with or endorsed by the Australian Taxation Office. It is intended to support organisation and preparation only. Tax rules can change and depend on individual circumstances. Users remain responsible for verifying their information and should consult current ATO guidance or a registered tax agent where appropriate.
