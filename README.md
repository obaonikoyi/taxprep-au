# TaxPrep AU

TaxPrep AU is an Australian tax-preparation assistant that helps individuals organise financial records, review possible work-related deductions, and prepare a clear summary before lodging through myTax or consulting a registered tax agent.

> **Project status:** Guided demo development
> **Important:** TaxPrep AU is an organisational and educational tool. It does not provide tax, legal, or financial advice and does not lodge tax returns.

## The Problem

Preparing an Australian individual tax return can be confusing and time-consuming. Information may be spread across bank statements, receipts, invoices, notes, and multiple jobs. People may struggle to:

- identify transactions that could be relevant to their tax return;
- organise expenses into understandable categories;
- keep supporting evidence linked to each expense;
- separate personal spending from work-related spending;
- understand which items require further review; and
- prepare an accurate summary for myTax or a registered tax agent.

Generic spreadsheets can store transactions, but they do not guide the user through the preparation process. TaxPrep AU aims to provide a simpler, structured workflow designed for Australian individual taxpayers.

## V1 Goal

Version 1 will help a user turn raw transaction records into an organised tax-preparation summary.

The goal is **preparation, not lodgement**: reduce manual sorting, highlight items that need review, and make it easier for the user or their tax agent to check the supporting information.

## Target User

V1 is intended for Australian individual taxpayers who:

- earn salary or wage income;
- may work for one or more employers;
- want to organise possible work-related expenses;
- have bank transaction data and receipts to review; and
- lodge through myTax or work with a registered tax agent.

## V1 Scope

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

The current milestone introduces a fictional profile named Sarah, a disability support worker. A visitor can confirm sample income, answer three work-expense discovery questions and receive a preparation summary. The demo uses no account, TFN, myGov login or real financial data.

See [`docs/MILESTONE_2_GUIDED_DEMO.md`](docs/MILESTONE_2_GUIDED_DEMO.md) for its user story, acceptance criteria and deferred work.

## Disclaimer

TaxPrep AU is an independent software project and is not affiliated with or endorsed by the Australian Taxation Office. Tax rules depend on individual circumstances and can change. Users remain responsible for verifying their information and should consult current ATO guidance or a registered tax agent when needed.

## Repository

This repository will contain the application source code, product documentation, tests, and technical decisions for TaxPrep AU.

## Licence

No open-source licence has been selected yet. Until a licence is added, all rights are reserved.
