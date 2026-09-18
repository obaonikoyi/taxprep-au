# TaxPrep AU — Product direction

Decision recorded: 18 September 2026, following Obadiah's clarification of the original problem. This document governs the future roadmap where older organiser-only plans differ. It does not change the capabilities or terms of the current public demo.

## The product we are building toward

TaxPrep AU should turn a person's receipts, bank transactions and relevant tax documents into an explainable tax preparation: extract the facts, resolve gaps with a short interview, evaluate supported deductions against the applicable tax-year rules, calculate supported outcomes and prepare the information for lodgment or an accountant's review.

The intended benefit is less manual tax work and less dependence on separately hiring an expensive tax agent for a straightforward return. A useful accountant handover is also a supported outcome. The project should eventually help people claim legitimate entitlements and avoid unsupported claims. It cannot promise universal correctness, guaranteed savings or the largest refund.

The existing app is a foundation: CSV validation, three expense categories, work-use calculations, source references, reports, browser save/resume, tests and hosting. Milestone 10 adds browser OCR, bounded document intake, evidence matching, correction and export. Milestone 11 adds a captured ATO-source register and draft phone-service rules with claim-ready output disabled. Qualified review and ongoing rule maintenance are pending. Generative AI analysis, reliable personalised deduction conclusions, full-return calculations and ATO integration are not implemented yet. See [Milestone 11](MILESTONE_11_PHONE_ASSESSMENT.md) for scope and the review pack. See [Milestone 10](MILESTONE_10_DOCUMENT_INTAKE.md) for the local processing design and its limitations.

## Eight intended user cases

| User should be able to… | What the app should do |
|---|---|
| Choose a tax year and describe their situation | Check supported years and circumstances; explain uncovered sections early. |
| Upload receipts, transaction history and relevant statements | Read supported formats and show processing progress without making the user retype every field. |
| Review the extracted facts | Show the original document/page alongside dates, descriptions and amounts; allow corrections. |
| Combine several sources for the same purchase | Match a receipt with its bank entry, retaining both sources while counting the expense once. Flag ambiguous matches, refunds and date mismatches. |
| Answer only questions the documents cannot answer | Ask about work purpose, reimbursement, personal use and evidence basis. Group repeated questions where the facts permit. |
| Understand a suggested tax treatment | Show applicable-year guidance, recorded facts, assumptions, calculations and unresolved conditions. Unsupported cases remain unresolved. |
| Understand the overall preparation | Show covered income/deduction sections, missing inputs and supported estimates; never present an incomplete return as complete. |
| Finish through the appropriate route | Produce a self-lodgment guide or an accountant handover; add direct lodgment only after a suitable operating model and approved integration. |

## What makes the experience simpler

The documents should do much of the data entry. The user's main work should be reviewing uncertain facts and answering questions only they can answer.

Example target, using fictional information: upload a bank CSV and several phone bills. The system links matching payments, flags a duplicate receipt and asks about work use and reimbursement. It then produces a traceable preparation item and an evidence checklist. It does not count the receipt and bank payment twice or guess a work-use percentage.

A bank statement alone is not the full input contract. The system must also collect or confirm the information required by the supported return model, including gross income, withholding and relevant personal circumstances. Unsupported sections must be visible. Document extraction is not proof that a return is complete.

## How the system should reach a result

| Component | Responsibility |
|---|---|
| OCR and AI extraction | Convert documents into candidate facts, with source locations and uncertainty. Treat document text as data, never as instructions to the application. |
| Reconciliation | Connect evidence to transactions; detect duplicates and inconsistencies without silently deleting ambiguous records. |
| Reviewed tax knowledge | Store authoritative references, year applicability, versions, assumptions and reviewed examples. |
| Rules and calculations | Evaluate supported conditions and calculate with tested code. Escalate interpretation that the rules cannot resolve. |
| Explanation and review | Explain the result in plain English and let the user or registered practitioner inspect and correct it. |

An LLM's confident wording must not establish eligibility or authorise a claim. Extraction confidence and confidence in tax treatment are separate questions. A receipt can be perfectly readable while the tax treatment remains unresolved.

## Correct-year guidance

The user selects a financial year, not just an arbitrary date range. Imported records can be filtered by dates, but tax conclusions must use rules applicable to that return's year and circumstances.

Maintain a curated source register with the ATO URL, effective year(s), retrieval/review date, version, relevant passage and reviewer. Retrieval selects only applicable material. Changes to an ATO page trigger review of affected rules and regression examples; they must not silently rewrite an existing report. Reports retain the rule version and evidence behind the original result.

Live searches can discover changes or assist research. They are not the sole mechanism for approving a deduction. If the source is missing, stale, contradictory or outside supported scope, the app should ask for review rather than improvise.

## What existing services demonstrate

Public provider claims checked on 18 September 2026; this is a limited comparison, not a hands-on product audit.

| Service | Observed offering | Implication for TaxPrep |
|---|---|---|
| [Etax](https://www.etax.com.au/etax-fees/) | Returns advertised from $87.49, with pre-fill, accountant support/checking and electronic lodgment. Extras and complex cases can cost more. | Convenience and a lower fee already exist. We must demonstrate a specific improvement in handling documents and uncertainty. |
| [One Click Life](https://oneclicklife.com.au/pricing/) | Standard individual returns advertised at $99; rental/investor/sole-trader service from $249, with optional extras. Its [tax-return page](https://oneclicklife.com.au/tax-return/) describes ATO pre-fill and accountant review. | Compare against established online services, not only the owner's previous $2,000–$3,000 experience. |

Proposed differentiation to test: upload-led preparation, fewer repeated questions, clear links from evidence to each conclusion, and a useful handover when human review is needed. No uniqueness or market-demand claim is established yet.

The suggested $10–$50 price range remains a hypothesis. Measure document-processing/model cost, storage, support, updates and any practitioner review before committing to a price. A document report and a lodged return are different service levels.

## Operating model and integrations

The [TPB guidance for digital service providers](https://www.tpb.gov.au/tpb-gs-14-2011-digital-service-providers-and-tax-agent-services-act-2009) distinguishes ordinary software from services applying tax law to a client's circumstances. Paid personalised guidance may require tax-agent registration arrangements even without lodgment; a disclaimer alone is insufficient. Obtain advice on the actual design. Investigate registration or engaging an appropriately registered practitioner, with genuine supervision and responsibility.

Reading ATO guidance and accessing a person's ATO data are different capabilities. The [ATO onboarding process](https://softwaredevelopers.ato.gov.au/getting_started) includes DSP registration, testing, security evidence and production whitelisting. The [security framework](https://softwaredevelopers.ato.gov.au/operational_framework) describes access requirements. Confirm that the desired services are available to our operating model; onboarding is not a guarantee of access to every endpoint. Never ask users to surrender myGov credentials for browser automation.

The public demo remains fictional-data only. Before real documents enter an AI service, implement appropriate user isolation, access controls, encryption, retention/deletion, provider handling and log redaction. Do not put real tax documents in source control or reuse the demo's localStorage design as a document vault.

These are parallel design tasks that enable the intended product. They do not redefine the ambition as an expense organiser forever.

## Build sequence

1. **Milestone 10 — document intake and evidence matching.** [Issue #18](https://github.com/obaonikoyi/taxprep-au/issues/18): one supported year, bounded CSV and receipt uploads, structured extraction, source matching, corrections and a reconciled report. Start with synthetic employee phone-service fixtures. No claim-approval wording.
2. **Milestone 11 — explainable deduction assessment.** One professionally reviewed category/year first; targeted questions, applicable ATO references, tested rule conditions and unresolved outcomes. Establish the paid-service operating model alongside this work.
3. **Milestone 12 — supported return preparation.** Income and withholding, supported personal circumstances, reliable calculations, completeness checks and a self-lodgment/agent handover. Detect rental, business, capital-gains, foreign-income and other unsupported complexity rather than omitting it.
4. **Later — broader coverage and lodgment.** Expand reviewed rules, practitioner workflow and authorised ATO integration once quality, operating requirements and demand justify them.

This sequence begins with employee cases of limited complexity. It does not promise that every employee return is simple or that every taxpayer can dispense with professional help.

## How we will decide it is useful

Evaluate extraction against known documents, including unreadable values and duplicates. For tax treatment, use professionally reviewed examples with expected outcomes, incorrect-year material, missing facts and cases that must remain unresolved. Trace every reported figure to facts and calculations. Measure correction effort, missed relevant items, unsupported suggestions, active user time and cost per completed preparation.

Only publish timing and accuracy claims after measuring them. Passing software tests alone does not validate tax correctness. Keep the portfolio website unchanged until Obadiah decides that the demonstrated user outcome is useful enough to showcase.
