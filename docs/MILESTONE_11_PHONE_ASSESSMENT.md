# Milestone 11 — explainable phone-expense assessment

Engineering implementation for [issue #21](https://github.com/obaonikoyi/taxprep-au/issues/21). **Qualified tax review is outstanding.** The public feature is a fictional-data draft, not a reliable personalised tax conclusion or a completed return. The milestone remains open for that review and the real-data/paid-service operating model.

## Visitor outcome

Open **Try document intake**, choose 2025–26 and the employee example, then **Try sample documents**. Review both records and link the bank entry to the receipt. Complete the work details and choose **Assess phone expense**. A $45 mobile-service bill with a documented 40% work-use share produces an **illustrative $18 work portion**, provided the draft conditions are answered. Every result states that tax review is pending. Export the evidence report to take the facts, calculation, conditions, source versions and open questions with you.

This uses the existing document evidence. Non-conflicting bank answers carry to the receipt on linking; conflicting answers must be resolved. Corrections to match facts invalidate links as before. Changing merchant, date or description also resets the additional phone confirmations. Amount changes recalculate; original facts remain in the source trail. Duplicate or unconfirmed records cannot produce an assessment amount. A same-supplier, in-year credit pauses the associated assessment until its relationship is resolved; credits are not automatically offset. This heuristic does not discover refunds hidden under unrelated bank descriptions.

## Supported scope

One AUD mobile calls/data service bill incurred by an employee, dated in 2025–26, using actual documented expenses. The user must confirm work-duty purpose, who paid, reimbursement, a reasonable work/private percentage, representative records and whether the expense overlaps another claim or a working-from-home method. No extrapolation from one month to a year.

Handsets, bundled device costs, depreciation, setup, insurance, incidental-use methods and record-keeping exceptions require separate review. Partial reimbursement is unresolved because its work/private allocation cannot be inferred. Availability-only casual-shift messages, job seeking and private use are draft exclusions. The fixed-rate overlap covers phone use away from home as well as at home. Missing evidence is unresolved within this standard-evidence path; it is not a statement that every missing receipt makes a deduction impossible.

No full return, tax/refund estimate, income, withholding, pre-fill, live ATO search, payment collection or lodgment is implemented. The original guided demo remains separately available. Documents and assessment answers stay in tab memory; the feature adds no server upload or external model call.

## Source and rule design

- `src/frontend/src/features/assessment/source-register.json`: three ATO pages, titles, QC identifiers, URLs, provisional year mapping, update/retrieval dates, exact snapshot hashes and condition mappings.
- `sources/*.txt`: readable article snapshots retrieved on 18 September 2026, attributed to the ATO. Copyright/reuse details are in `sources/README.md`.
- `phone.ts`: draft rule version `employee-phone-2025-26.v1-draft`, immutable content-hash bindings, source-health checks, integer-cent arithmetic and explanatory findings.
- `verify-assessment-sources.mjs`: tests/builds reject missing snapshots, changed hashes or mismatched rule bindings.
- Source checks use a **180-day project maintenance policy**, not an ATO rule. Missing, duplicate, changed, conflicting, withdrawn, stale, future-dated or wrong-year source entries block arithmetic. This does not guarantee a page has not changed earlier; source monitoring and practitioner review remain future operational responsibilities.
- Pending source and rule review always block claim-ready output. `claimReady` is literally `false` in this public prototype. There is no UI switch to approve a claim. Marking a source reviewed alone will not turn it into a production tax service.
- Calculation: integer bill cents × integer percentage basis points / 10,000, rounded half up to cents. Values are bounded well below JavaScript's exact-integer limit. This is not annual tax-return whole-dollar rounding.

The report includes its generation date, rule/source collection versions, each source hash/date, current facts, original extracted facts, source-file hashes/page or row references, user answers, calculation and unresolved conditions. It does not embed the source receipt images or ATO article bodies; retain the original files and use the versioned repository snapshots for review.

## Review pack — expected examples are provisional

These expectations are engineering interpretations of captured guidance, **not practitioner-approved examples**. `phone.test.ts` supplies the reproducible inputs and assertions. A qualified reviewer must inspect both the source passages and full conditions, correct the rules/examples as needed and record their review before real-user conclusions are enabled.

| Example | Provisional outcome |
|---|---|
| $45 service; 40% documented work use; all conditions confirmed | $18 illustrative work portion; still not claim-ready |
| Same bill at 0% / 100% | $0 / $45 arithmetic; tax review still pending |
| One-cent service amount at 50% | One cent after half-up rounding |
| Employer pays or reimburses the whole bill | Draft no separate amount |
| $10 of a $45 bill reimbursed | Unresolved allocation; do not infer $35 × 40% |
| Work-from-home fixed rate, including calls away from home | Draft no additional phone amount |
| Service already included elsewhere | No additional amount; resolve the other entry |
| Only casual availability/shift offers, job seeking or private use | Draft no separate amount |
| Mixed purposes not separated | Unresolved work-duty condition |
| Missing purpose, percentage, evidence basis or representative record | Unresolved; no amount |
| Bank entry without supplier bill | Standard-evidence path unresolved; exceptions not decided |
| Handset, device bundle, setup or other non-service cost | Outside scope; no service calculation |
| Unconfirmed facts, unresolved duplicate, excluded record or wrong-year date | No assessment amount |
| Linked bank and receipt for one payment | One assessment with both source references |
| Changed merchant breaks the link | Assessment paused for reconciliation and reconfirmation |
| Same-supplier credit might relate to bill | Unresolved; no automatic refund allocation |
| Missing/stale/conflicting/changed/wrong-year source | No arithmetic until source issue is resolved |
| Complete facts but professional review pending | Illustration only, claim-ready false |

### Outstanding review record

- Reviewer name, qualifications/registration and scope: **not assigned**.
- Reviewed source applicability and rule version: **pending**.
- Signed-off expected examples and exceptions: **pending**.
- Review date, findings and next review date: **pending**.
- Real-data security/handling and paid-service/TPB operating model: **pending**; see [Product direction](PRODUCT_DIRECTION.md). A disclaimer does not settle these requirements.

No practitioner has been contacted or represented as having approved this work. Keep issue #21 open until its external review criteria are actually met.

## Verification

Local lint, TypeScript production build and frontend tests cover the rules, source-health failures, monetary bounds, evidence continuity and escaped reports. Existing GitHub gates also run the API tests, actual browser OCR journey and production-container journey.

The browser scenario carries a work answer from bank to receipt, produces $18, changes to fixed-rate overlap ($0), changes to partial reimbursement (unresolved), introduces duplicate evidence (assessment paused), and introduces a possible refund (unresolved). It checks report contents, source links, mobile overflow and that the document journey makes no upload or external AI request. These tests verify software behavior, not professional tax correctness. Release-specific CI, screenshots and deployment records are recorded after verification.
