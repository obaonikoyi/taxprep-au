# TaxPrep AU

TaxPrep helps Australian workers understand their pay, track withholding and recorded super, and prepare for tax time with fewer surprises. The longer-term goal remains supported self-preparation or a useful accountant handover.

> **Published: Milestone 16A — year-end pay reconciliation.** Checked payslips can now be compared with manually entered final/provisional annual employment sources without counting both views as separate income. Tax/refund results remain locked pending qualified review.

**[Try the standalone app](https://taxprep-au-production.up.railway.app)** — no account needed. Choose **Try example payslips** for six fictional PDFs and an immediate pay-history dashboard. The owner's portfolio website has not been changed.

[Product direction](docs/PRODUCT_DIRECTION.md) · [Current milestones and user cases](docs/PROJECT_PLAN.md) · [Milestone 15A pay outlook](docs/MILESTONE_15A_PAY_OUTLOOK.md) · [Milestone 15B-1 tax readiness](docs/MILESTONE_15B1_TAX_READINESS.md) · [Milestone 16A year-end reconciliation](docs/MILESTONE_16A_INCOME_RECONCILIATION.md) · [Development](docs/DEVELOPMENT.md)

## Payslip dashboard

Follow **Add payslips → Check figures → View summary**. Own files open for review immediately; each confirmation takes you to the next payslip. Use **Pay / Tax / Super** to choose a chart. **Use my own payslips** clears the fictional example. The mobile review uses selectable cards, and clearing a history asks you to confirm.

Upload supported labelled summary PDFs or enter figures manually, review their source and confirm the period amounts. See gross and net pay, withholding dollars/percentage and recorded super across employers and financial years. Switch payday/month charts, inspect exact values, check observed changes and export a report with source references and corrections.

The first automatic reader supports the **PAYSLIP SUMMARY v1** layout demonstrated by the example, not arbitrary employer PDFs. Limits: 20 files per batch, 2 MB and one native-text page each, 100 records per session. Other layouts and scans need manual entry. Required missing values are not zero; super can stay unknown. User files need confirmation before charts, edits invalidate it, repeated files/pay identities are blocked and cumulative YTD fields are excluded.

Files are processed in the browser tab with no model requests, uploads or saved pay history. Refreshing or switching workspaces clears the session; download a report first. Example and personal records cannot be mixed. Super means **recorded on the payslip**, not confirmed fund receipt. This release checks arithmetic and data consistency, not award compliance, employer remittances, final tax or refund entitlement. TaxPrep does not lodge returns.

Published: [Milestone 15A — pay outlook](docs/MILESTONE_15A_PAY_OUTLOOK.md) adds an optional one-employer scenario after the checked pay summary. It asks for the next payday, regular frequency and editable normal pay, then shows entered gross, 20% less and 20% more through 30 June. Future withholding is carried forward only for the unchanged entered-pay pattern; changed-gross rows deliberately say **Not estimated**. This is pay arithmetic, not final tax or a refund estimate.

Published: [Milestone 15B-1 — tax readiness](docs/MILESTONE_15B1_TAX_READINESS.md) collects whole-year profile facts, missing information and unsupported circumstances while keeping every tax/refund result locked.

Published: [Milestone 16A — year-end pay reconciliation](docs/MILESTONE_16A_INCOME_RECONCILIATION.md) compares checked payslip history with manually entered income statements/payment summaries. Final annual sources and payslips are shown as two views of the same employment income, never added together. Provisional sources stay visible but are excluded from final annual totals; mismatches remain review questions. Annual-statement document extraction remains deferred in #30.

The reviewed withholding/annual-tax work remains under [Milestone 15](https://github.com/obaonikoyi/taxprep-au/issues/36) after #28. Existing tax-rule review remains open in #21 and #28.

## Statement analysis

The **Bank spending** workspace reads a supported native-text CommBank PDF or a CSV with `Date,Description,Amount` headings. It shows money received, money out, net movement, monthly totals, suggested categories, possible recurring payments and similar entries. Search the transactions, correct categories, add work-review notes and download an offline report for the selected dates.

PDF imports must match every running balance and the printed totals. CSV totals have an explicit **balance check unavailable** label. Transfers and repayments remain part of cash movement; deposits are never treated as gross employment income. Category suggestions use transparent keyword rules, not generative AI or tax eligibility decisions.

Statement files are processed in the browser tab, with no document upload, model request or saved history. Refreshing, clearing or switching workspaces clears the session. Limits: one file, 10 MB, 60 PDF pages and 5,000 transactions. Scans and other PDF layouts need a CSV export. The public example and test fixtures are entirely invented. [Milestone 13 scope and verification](docs/MILESTONE_13_STATEMENT_ANALYSIS.md).

## Document intake preview

Choose **Tax documents** in the [standalone demo](https://taxprep-au-production.up.railway.app). Select **2025–26** and the employee example, then **Try sample documents**. Review both extracted records and link them to count a $45 payment once with two sources. Add the missing work details, choose **Assess phone expense**, and complete the remaining conditions. The $45 sample at 40% work use illustrates $18, with tax review explicitly pending. Download the report with evidence, questions and source versions.

Milestone 10 adds real browser OCR for bounded fictional CSV/PDF/PNG/JPG inputs, original-source review, duplicate/refund/date flags, corrections and export. Documents stay in the tab; no external AI account is required. Refreshing clears the document session. This prepares evidence, not approved deductions or a full tax return. See [implementation and limits](docs/MILESTONE_10_DOCUMENT_INTAKE.md).

Milestone 11 adds deterministic draft phone-service conditions, three captured ATO sources with version/hash checks, targeted follow-ups and an explainable report. Unreviewed rules never produce a claim-ready result. [Implementation, review pack and outstanding gate](docs/MILESTONE_11_PHONE_ASSESSMENT.md).

## Income and preparation handover

Inside document intake, choose **Preparation summary** → **Load fictional income example**. Review three annual records to see $82,150 recorded gross income and $17,100 tax withheld. The existing $18 phone illustration stays separate. Change figures, check unsupported circumstances, and download one handover with income, evidence and remaining questions.

Milestone 12A added input collection and completeness checks. Milestone 12B adds a separate no-deduction fictional tax calculation; it never infers salary from net deposits or issues a reliable personalised refund estimate. [Milestone 12A scope and verification](docs/MILESTONE_12A_PREPARATION_HANDOVER.md).

For the new calculation, start an empty document session, open **Preparation summary**, load the fictional income example and confirm its three income records. The sample shows a **$24 fictional refund balance** with a full breakdown. Expenses and unsupported circumstances block it. [Milestone 12B scope, sources and verification](docs/MILESTONE_12B_TAX_POSITION.md).

## The Problem

Preparing an Australian individual tax return can be confusing and time-consuming. Information may be spread across bank statements, receipts, invoices, notes, and multiple jobs. People may struggle to:

- identify transactions that could be relevant to their tax return;
- organise expenses into understandable categories;
- keep supporting evidence linked to each expense;
- separate personal spending from work-related spending;
- understand which items require further review; and
- prepare an accurate summary for myTax or a registered tax agent.

Generic spreadsheets can store transactions, but they do not guide the user through the preparation process. TaxPrep AU aims to provide a simpler, structured workflow designed for Australian individual taxpayers.

## Original organiser foundation (historical scope)

Version 1 will help a user turn raw transaction records into an organised tax-preparation summary.

The goal is **preparation, not lodgement**: reduce manual sorting, highlight items that need review, and make it easier for the user or their tax agent to check the supporting information.

## Target User

V1 is intended for Australian individual taxpayers who:

- earn salary or wage income;
- may work for one or more employers;
- want to organise possible work-related expenses;
- have bank transaction data and receipts to review; and
- lodge through myTax or work with a registered tax agent.

## Original V1 scope

### 1. Tax-year workspace

- Create a workspace for an Australian financial year.
- Store basic preparation details for that workspace.
- Show progress through the preparation workflow.

### 2. Transaction import

- Import transactions from a supported CSV format.
- Preview and validate data before adding it.
- Detect missing or invalid fields.
- Prevent obvious duplicate imports.

### 3. Transaction review

- View, search, filter, and sort imported transactions.
- Mark transactions as personal, income-related, potentially deductible, or needing review.
- Edit transaction descriptions and add notes.
- Split or exclude a transaction when appropriate.

### 4. Expense categorisation

- Assign transactions to common Australian work-expense categories.
- Suggest a category using simple rules.
- Require the user to confirm suggestions.
- Allow uncategorised and custom notes for uncertain items.

### 5. Receipt and evidence tracking

- Record whether evidence is available for an expense.
- Attach or reference a receipt where supported.
- Add notes explaining the work-related purpose.
- Highlight entries with missing evidence or incomplete details.

### 6. Review guidance

- Ask plain-language questions to help the user review an item.
- Display general educational explanations.
- Flag uncertain, mixed-use, or incomplete entries for manual review.
- Encourage the user to check ATO guidance or consult a registered tax agent.

### 7. Preparation summary

- Summarise confirmed items by category.
- Show totals, evidence status, and entries needing review.
- Export a preparation report in a practical format such as PDF or CSV.
- Make the report suitable for checking before using myTax or meeting a tax agent.

### 8. Basic data protection

- Validate uploaded files.
- Avoid exposing sensitive financial data in application logs.
- Provide a clear way to remove a workspace and its stored data.
- Apply reasonable security controls appropriate to the chosen architecture.

## Typical V1 Workflow

1. Create a workspace for the financial year.
2. Import a bank transaction CSV.
3. Review and correct the imported transactions.
4. Categorise possible work-related expenses.
5. Record receipts, evidence, and notes.
6. Resolve or flag uncertain items.
7. Generate a preparation summary.
8. Use the summary as a guide when completing myTax or speaking with a registered tax agent.

## Explicitly Out of Scope for V1

V1 will **not**:

- lodge a tax return with the Australian Taxation Office;
- connect directly to ATO Online services or myGov;
- act as a registered tax agent;
- guarantee that an expense is deductible;
- calculate a final tax refund, tax debt, or legally binding tax position;
- provide personalised tax, legal, or financial advice;
- automatically claim deductions without user confirmation;
- support businesses, companies, trusts, partnerships, or SMSFs;
- prepare BAS, GST, payroll, or company tax returns;
- support complex investments, cryptocurrency tax, capital gains calculations, rental properties, or foreign tax calculations;
- import every bank's statement format;
- connect directly to bank accounts through Open Banking;
- include a native iOS or Android application;
- include multi-user accounting-firm workflows; or
- retain sensitive documents indefinitely without an explicit data-retention design.

These exclusions keep the first release realistic, testable, and focused on solving one clear problem well.

## Product Principles

- **User confirmation:** Suggestions assist the user; they do not make tax decisions.
- **Clear language:** Explanations should be understandable without accounting knowledge.
- **Evidence first:** The product should encourage accurate notes and supporting records.
- **Privacy by design:** Collect only the information needed for the preparation workflow.
- **Transparent uncertainty:** When the system is unsure, it should say so and request review.
- **Australian focus:** Categories and guidance should align with the Australian individual-tax context.

## V1 Success Criteria

V1 will be considered successful when a user can:

- import a supported transaction file without manually copying every row;
- review and categorise transactions in one workspace;
- identify entries with missing evidence or unanswered questions;
- see category totals and unresolved items clearly; and
- export a useful preparation summary for myTax or a tax-agent discussion.

## Planned Delivery Stages

1. **Discovery and requirements** — confirm users, workflows, risks, and V1 boundaries.
2. **UX and data design** — design screens, data model, validation, and privacy controls.
3. **Project foundation** — establish application structure, quality checks, and development workflow.
4. **Core transaction workflow** — build CSV import, review, search, and categorisation.
5. **Evidence and guidance** — add receipt tracking, notes, questions, and review flags.
6. **Reporting** — create category summaries and exports.
7. **Testing and release** — test accuracy, usability, security, and edge cases before an initial release.

## Current Portfolio Demo

Try **Explore example summary** for an immediate walkthrough, or **Try demo** to guide Sarah, a fictional disability support worker, through three expense categories. Record amounts, work-use percentages, reimbursement and evidence; then edit the entries and review missing information. The backend calculates recorded work portions without deciding tax eligibility. The demo needs no account or identity details.

See [Milestone 5](docs/MILESTONE_5_EXPENSE_REVIEW.md) for the current user stories, sample numbers and API contract. Entries remain in the current tab unless you explicitly choose **Save progress**. The browser copy can be resumed after refresh or reopening the page. Summary requests are processed in memory and are not stored on the server.

The CSV screen now uploads a fictional CSV to the ASP.NET Core API for validation. Try the built-in 20-row sample, review valid rows alongside errors, retry a failed request or clear the preview. Totals come from the backend. Uploads are processed in memory. Selected rows can be saved into an expense and included in the explicit browser progress snapshot.

- [Run and test locally](docs/DEVELOPMENT.md)
- [Milestone 4 and API contract](docs/MILESTONE_4_IMPORT_API_TESTS.md)
- [Issue #6](https://github.com/obaonikoyi/taxprep-au/issues/6) / [PR #5](https://github.com/obaonikoyi/taxprep-au/pull/5)

After a successful expense review, use **Download report (HTML)** for an offline copy, **Preview report** to inspect it, or **Print / save PDF** to open the browser print dialog. The report preserves evidence notes, rounded amounts and partial-total labels. No extra data is sent to the server for export. Downloaded copies stay on your device after a restart.

Select validated CSV spending, choose a category and complete its expense draft. Up to 50 rows can form one category record; original source references remain visible in the summary and report. Work-use and evidence answers stay explicit, and matching saved rows cannot be silently imported twice.

**Save progress** includes your current step, unfinished form text, expense records and selected source references. **Resume saved progress** restores that copy and requests a fresh review. **Delete saved progress** removes the copy while keeping current entries; **Restart demo** clears both. Save again after later changes. This is same-browser storage, with no account or device sync.

The standalone deployment packages the website and API together. Follow the on-page **Try one useful task: a phone expense** walkthrough to turn a sample bill into a report. See [Milestone 9](docs/MILESTONE_9_STANDALONE_DEMO.md) for hosting, verification and the readiness decision. Publication is separate from adding the project to Obadiah's portfolio website.

Current: [Milestone 15B-1 — tax readiness](docs/MILESTONE_15B1_TAX_READINESS.md) builds on [Milestone 15A — pay outlook](docs/MILESTONE_15A_PAY_OUTLOOK.md) and [Milestone 14 — payslip dashboard](docs/MILESTONE_14_PAYSLIP_DASHBOARD.md), alongside [Milestone 13 — statement analysis](docs/MILESTONE_13_STATEMENT_ANALYSIS.md). The separate document workspace retains [Milestone 12B — fictional tax position](docs/MILESTONE_12B_TAX_POSITION.md), [Milestone 12A — income and preparation handover](docs/MILESTONE_12A_PREPARATION_HANDOVER.md), and the [draft phone assessment](docs/MILESTONE_11_PHONE_ASSESSMENT.md). [Issue #21](https://github.com/obaonikoyi/taxprep-au/issues/21) and [issue #28](https://github.com/obaonikoyi/taxprep-au/issues/28) remain open for qualified review. Statement analysis does not feed bank deposits or flagged spending into the tax calculation.

- [Milestone 5 issue #7](https://github.com/obaonikoyi/taxprep-au/issues/7)
- [Milestone 9 standalone demo](docs/MILESTONE_9_STANDALONE_DEMO.md) / [issue #15](https://github.com/obaonikoyi/taxprep-au/issues/15)
- [Milestone 8 save/resume contract](docs/MILESTONE_8_SAVE_RESUME.md) / [issue #13](https://github.com/obaonikoyi/taxprep-au/issues/13)
- [Milestone 7 CSV-to-expense flow](docs/MILESTONE_7_CSV_EXPENSE_REVIEW.md) / [issue #11](https://github.com/obaonikoyi/taxprep-au/issues/11)
- [Milestone 6 report format and verification](docs/MILESTONE_6_PREPARATION_REPORT.md) / [issue #9](https://github.com/obaonikoyi/taxprep-au/issues/9)

## Disclaimer

TaxPrep AU is an independent software project and is not affiliated with or endorsed by the Australian Taxation Office. Tax rules depend on individual circumstances and can change. Users remain responsible for verifying their information and should consult current ATO guidance or a registered tax agent when needed.

## Repository

This repository will contain the application source code, product documentation, tests, and technical decisions for TaxPrep AU.

## Licence

No open-source licence has been selected yet. Until a licence is added, all rights are reserved.
