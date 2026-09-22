# Milestone 12B — explain a bounded employee tax position

Implements the engineering scope of [issue #28](https://github.com/obaonikoyi/taxprep-au/issues/28). The preparation workspace now shows deterministic fictional tax arithmetic or specific reasons it cannot calculate. Reliable personalised estimates remain disabled. Qualified review of rules, examples, filing/settlement rounding and the real-data operating model is still pending; [issue #21](https://github.com/obaonikoyi/taxprep-au/issues/21) remains open.

## Try it

1. Choose **Try document intake**, 2025–26 and the employee example; start document review.
2. Without adding expense files, choose **Preparation summary → Load fictional income example**.
3. Review and confirm the three income records. Review the supplied fictional situation answers.
4. The calculation below the preparation steps shows $82,150 income, $15,433 income tax, $0 LITO, $1,643 Medicare, $0 surcharge, $17,076 total and $17,100 withholding: a **$24 fictional refund balance**.
5. Change the first salary from $64,000 to $65,000. The result disappears until that record and the complete income list are confirmed again. It then becomes **$296 fictional amount payable**.
6. Download the preparation handover; the same breakdown, assumptions, source hashes and review status are included in the offline report.

Existing phone/document examples remain useful independently. Any expense document (even excluded, zero or unresolved) blocks this first no-deduction tax calculation. Selecting “no deductions” cannot approve or silently ignore an expense. Use a new cleared session for the no-expense example, and export existing work before clearing it. Nothing is saved across refreshes.

## Explicit supported profile and input contract

- Financial year 2025–26 only; adult and Australian tax resident throughout the year, entitled to the full resident threshold, with no working holiday maker or other special tax-rate treatment.
- Salary/wages and sole-owner Australian bank interest only; all records finalised, reviewed, nonduplicate and complete. Net bank deposits are never inferred to be income.
- Single throughout the year, no dependants, full-year Medicare entitlement and no full/half levy exemption days; not entitled to SAPTO.
- No deductions, losses, other offsets (apart from automatic LITO), additional employment fields, reportable benefits/super, FHSS releases, exempt foreign income, trust amounts or other relevant income-test components.
- No private health insurance, study/training loan, PAYG instalment, other credit or ATO account adjustment. Bank-interest withholding must be explicitly zero; that credit path needs its own review.
- Total income from $0 to $101,000 inclusive. Higher income is blocked because this version does not implement surcharge tiers. No implicit zero is substituted for missing facts.
- All situation answers must match this profile. Mixed/partial-year or unsure circumstances block all arithmetic rather than issuing an outcome from a partial subtotal.

These exclusions make income for MLS purposes equal to the scenario taxable income. The application does not assume this equality for other profiles. No Medicare surcharge, loan repayment, private-health rebate or other offset is silently skipped: each is zero only under the explicit supported conditions.

## Rule mapping and numerical policy

The five ATO captures in `features/tax-position/sources` were retrieved on **19 September 2026**. `source-register.json` records URL, QC, update/retrieval dates, year, hash and pending review. Unrelated year tables are omitted from the rate/surcharge captures and labelled as excerpts. ATO material is reused under the source pages' permission; this is not ATO endorsement.

| Component | Provisional engineering mapping | Official source |
|---|---|---|
| Resident income tax | $0 to $18,200; 16% of excess to $45,000; $4,288 + 30% of excess to supported $101,000 cap | [Resident rates, 2025–26 table](https://www.ato.gov.au/tax-rates-and-codes/tax-rates-australian-residents) |
| LITO | $700 to $37,500; reduced 5c/$ to $45,000; then $325 reduced 1.5c/$. Floor at zero; cap used offset at income tax. Does not offset Medicare. | [Low income tax offset](https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/tax-offsets/low-income-tax-offset) |
| Medicare | Single non-SAPTO threshold $28,011; draft taper 10% of excess capped at 2% of taxable income. Matches ATO Angie's $29,000 / $98.90 example. The taper interpretation still requires qualified verification. | [Single thresholds and Angie example](https://www.ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy/medicare-levy-reduction/medicare-levy-reduction-for-low-income-earners), [myTax 2026 reductions/exemptions](https://www.ato.gov.au/individuals-and-families/your-tax-return/instructions-to-complete-your-tax-return/mytax-instructions/2026/medicare-and-private-health-insurance/medicare-levy-reduction-or-exemption) |
| Surcharge | Zero within the $101,000 single threshold, only after excluding additional MLS income components | [2025–26 MLS income and thresholds](https://www.ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy-surcharge/medicare-levy-surcharge-income-thresholds-and-rates) |
| Balance | Reviewed salary withholding minus illustrated tax after LITO and Medicare | Engineering composition of the supported components; no existing ATO debt/credit settlement prediction |

Amounts use bounded integer cents and integer rate multipliers. The illustration retains cents as entered and rounds each resulting tax/offset/levy component half up to cents. In particular, rounding applies to the resulting offset, not to its reduction. This is an **explicit project illustration policy**, not a claim that ATO filing and final-assessment rounding has been verified. No annualisation or whole-dollar conversion is applied. This pending verification is one reason the result is fictional and `estimateCents` stays null.

Rule version: `employee-no-deductions-2025-26.v1-draft`. Source version: `ato-employee-2025-26.2026-09-19`. `claimReady` is always false. A checkbox or changed source review label cannot unlock a real estimate. A future approved version requires reviewed code, input/rounding contract, expected examples and recorded reviewer findings.

Build/test gates hash the actual stored source content and compare rule bindings. Runtime checks reject missing/duplicate sources, changed hashes, conflicts, wrong years, invalid/future retrieval dates, withdrawn or unexpectedly approved entries and retrievals older than 180 days. The age limit is project maintenance policy. It does not detect remote ATO changes automatically or mean rules remain valid for 180 days; no live ATO search or generative AI is claimed.

## Verification

Unit tests cover tax-free, LITO and Medicare transitions, the $101,000 scope boundary (including cents), nonrefundable offsets, both balance directions, exact even balance, edit invalidation, duplicates, missing/unsupported/partial circumstances, failed imports, expense-review isolation, invalid sources and escaped reports. The official Angie example is an external arithmetic check; other expected examples are engineering calculations, not professional approval.

`tax-position-smoke.mjs` runs inside the real document/browser journey after a cleared session. It verifies the actual UI calculation, disappearing stale results, unsupported deductions/unknown loans, threshold crossing, desktop/mobile layout, download and offline report reopening. The existing real OCR flow checks that the $18 phone illustration never becomes a deduction in the new engine. CI runs frontend checks, API tests and the production container journey before merge. Public browser verification follows deployment.

No new dependency, backend service, account, storage, document upload, model call or ATO integration was added. The standalone demo uses fictional data; the portfolio website is unchanged.

## Remaining professional and product work

Before real-user tax conclusions, obtain qualified review of the phone rules and this calculation (including all rounding and boundary expectations), define the real-data/paid-service operating model, and expand verified deduction coverage. Income-statement extraction remains a useful next engineering stage: turn a bounded document into reviewable income fields without inferring gross salary from bank deposits. This stage does not make Xoba Paycheck a replacement tax agent or a complete myTax guide.

## Publication record

- Feature merged in [PR #29](https://github.com/obaonikoyi/taxprep-au/pull/29), commit `d706398db7957f9ed89cd1ef5919c0d91acd0795`.
- [Final feature CI](https://github.com/obaonikoyi/taxprep-au/actions/runs/35410263132) passed all three jobs, including **247 frontend tests**, lint/build, backend/API/browser and the production-container journey.
- Production artifact `10574066578` records the $24 fictional refund balance, changed $296 payable, $17,076 tax/Medicare total, unknown-answer and expense blockers, edit invalidation, upper threshold and offline handover. Desktop/mobile screenshots were inspected; no overflow, page errors, document uploads or external model requests were observed.
- Railway feature deployment `4425d8fb-5a28-4868-ad37-0e18004aff39`. The publication PR records deployment success and runs the public browser journey through the existing `deployment.json` verification workflow before merge.
- [Issue #28](https://github.com/obaonikoyi/taxprep-au/issues/28) remains open for qualified source/rule/example and filing/settlement rounding review. No reliable personalised estimate is enabled. Phone review remains open in #21.
- [Next engineering milestone #30](https://github.com/obaonikoyi/taxprep-au/issues/30): extract reviewable income facts from a bounded fictional statement format.
- Standalone [demo](https://taxprep-au-production.up.railway.app) only; portfolio website unchanged.
