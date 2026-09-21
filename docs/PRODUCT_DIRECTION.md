# TaxPrep AU — product direction

Decision updated 19 September 2026 after the payslip and year-round dashboard discussion. This document and [delivery plan](PROJECT_PLAN.md) supersede the earlier organiser-only roadmap.

## What TaxPrep is

**TaxPrep helps Australian workers understand their pay, track their tax and super, and prepare for tax time with fewer surprises.**

The original motivation remains: reduce the effort and expense of preparing a straightforward return, whether the person finishes through myTax or takes an organised report to an accountant. The year-round pay experience creates a reason to return before tax season.

A person uploads a payslip, checks unclear facts and sees what was earned, withheld and recorded as super. As confirmed periods accumulate, the app builds a history. Later, a supported tax profile and verified calculations can support forecasts and preparation. Additional documents do not automatically make an incomplete tax profile complete.

## The experience

| Question | Product response |
|---|---|
| What happened to my pay? | Gross earnings, other deductions, withholding and take-home pay, with source references. |
| How much is being withheld? | Dollars and share of gross for each payday or month, clearly distinct from final annual tax. |
| What about multiple jobs? | Employer filters and combined confirmed figures, with no duplicate income. |
| What does my payslip say about super? | Recorded contribution amounts and missing information; not a fund balance or proof of receipt. |
| What changed? | Explain observed changes, different period lengths, gaps and inconsistencies without inventing their cause. |
| Where am I heading? | Later: actual figures plus separately labelled projections, assumptions and supported circumstances. |
| How do I get ready for tax time? | Later: reconcile income and expense evidence, resolve questions and produce a preparation handover. |

Design charts with solid actuals and clearly distinct projections when forecasts exist. Payment dates, pay periods and financial years have different roles. Users paid weekly, fortnightly or monthly should not be compared as if their pay periods were identical. TaxPrep must not create earnings for missing periods.

## What is implemented

Milestones 1–13 provide expense review, CSV/API validation, reports, fictional progress save/resume, local receipt OCR/evidence matching, annual income entry, a restricted fictional tax illustration and local statement analysis. [Milestone 14](MILESTONE_14_PAYSLIP_DASHBOARD.md) adds the reviewed payslip dashboard.

Milestone 14 has no generative AI, tax forecast, verified award-rate audit, ATO pre-fill, lodgment, bank connection or persistent pay history. Its automatic reader supports a documented labelled PDF summary format; other formats have manual entry. This is an explicit first format, not a claim of compatibility with every payroll provider.

## How the system reaches an answer

1. Read supported documents into candidate facts. Retain source identity and original extracted values.
2. Ask the user to confirm or correct the facts. Missing values remain unresolved.
3. Reconcile duplicates and conflicting records. An annual total and underlying payslips are alternative evidence for the same earnings.
4. Derive figures using tested integer-cent calculations. Keep current-period amounts separate from cumulative YTD values.
5. Explain recorded changes in plain language. Later AI explanations must refer to the calculation facts and treat document content as untrusted data.
6. For tax conclusions, require supported circumstances and verified applicable-year rules; unresolved coverage stays visible.

A payslip's arithmetic can be checked without proving wage entitlement or employer compliance. Award/classification, hours, penalties and agreements may need additional evidence. Super fund receipt and ATO remittance require evidence beyond the payslip. Use specific questions and checks, not a blanket green “correct payslip” verdict.

## Australian scope and maintained rules

Start with Australian employees. Ordinary personal income-tax brackets are national, not separate employee income-tax rates for each state. Tax residency, income and the financial year matter. State payroll tax is a separate employer obligation. Sources checked 19 September 2026: [Moneysmart income tax](https://moneysmart.gov.au/work-and-tax/income-tax), [RevenueSA payroll tax](https://www.revenuesa.sa.gov.au/payroll-tax), [Fair Work payslip requirements](https://www.fairwork.gov.au/pay-and-wages/paying-wages/pay-slips).

Payroll withholding schedules and annual tax calculations are separate. Maintain an ATO source register containing URLs, applicable years/effective dates, retrieved content/hash, review status and calculation examples. Discover changes centrally; review and test them before activation. Opening an app or logging in must not cause an AI web search to silently replace financial rules. Older reports retain their original rule versions.

The current draft phone and annual-calculation review gates in #21 and #28 remain open. This product decision does not invent qualified approval.

## Differentiation to test

The broad idea is not unique. [TaxTank Work Tank](https://taxtank.com.au/income-tax/) advertises employment-income tracking, multiple employers, withholding and income forecasts (public page checked 19 September 2026; not a hands-on audit).

Our hypothesis is that a short payslip-upload experience, understandable changes, traceable corrections and a clear path into tax preparation could be useful for people with variable hours or multiple jobs. The sharper hypothesis is Milestone 18: payroll software checks pay from the employer's side, the Fair Work pay calculator never sees a payslip, and income trackers record what arrived — so comparing the rate a person agreed to against the payslips they were actually given may be the gap worth occupying. That is a hypothesis to test with users, not a market claim. [The user test](USER_TEST_MILESTONE_18.md) is written and its materials piloted; it has not been run, so nothing here has been observed yet. Adelaide is a sensible place to recruit initial users, not a separate income-tax jurisdiction.

Evaluate whether a new visitor can understand a sample immediately, whether supported documents need many corrections, whether people understand the withholding/final-tax distinction, and whether the year-end handover reduces repeated work. Measure time and accuracy before publishing claims. Pricing remains undecided.

## Roadmap

- **14 — Pay understanding:** #35; documents, confirmation, actual-history charts, observations and export.
- **15 — Tax outlook:** #36; confirmed tax profile, verified withholding checks and bounded annual scenarios.
- **16 — Preparation:** #37; reconcile annual income, pay history and bank/receipt evidence into a supported year-end handover. #30 is the deferred annual-statement format.
- **18 — Agreed pay rate:** extends #35; record the rate agreed in a contract and raise specific dated arithmetic questions where a payslip disagrees with it or with itself. Checks the payslip against the user's own record, never against an award or legal minimum; the super-guarantee check stays behind the same reviewed-source gate as #21 and #28. [Scope](MILESTONE_18_AGREED_PAY_RATE.md).
- **Later:** additional payroll layouts, OCR/AI extraction where useful, explicitly designed history storage, broader reviewed tax rules, practitioner workflows and authorised integrations.

The standalone prototype is authorised for publication. The portfolio website remains unchanged until Obadiah decides to showcase it.

## Operating model and sensitive data

Current pay/statement analysis is local arithmetic and organisation; it does not unlock personalised tax conclusions. Keep private financial documents out of source control, fixtures, telemetry and public examples. Before adding remote AI, accounts or a document vault, define provider handling, access control, encryption, retention/deletion and log redaction.

For paid personalised tax services, obtain advice on the actual operating model. [TPB digital-service-provider guidance](https://www.tpb.gov.au/tpb-gs-14-2011-digital-service-providers-and-tax-agent-services-act-2009) remains relevant; a disclaimer alone does not settle responsibilities. [ATO developer onboarding](https://softwaredevelopers.ato.gov.au/getting_started) and the [operational framework](https://softwaredevelopers.ato.gov.au/operational_framework) are separate integration work. Never ask for myGov credentials to automate a user's account.
