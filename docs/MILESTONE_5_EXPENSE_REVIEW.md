# Milestone 5 — Guided expense details and evidence review

## Outcome

Sarah's fictional demo now turns answers into editable expense records and a useful preparation checklist. A visitor can try the complete interview or click **Explore example summary** to see it immediately.

[Tracking issue #7](https://github.com/obaonikoyi/taxprep-au/issues/7).

## User stories delivered

1. Answer Yes to enter one expense in a category, or No to skip it.
2. Record amount paid, work-use percentage, work purpose and the basis for that percentage.
3. Record reimbursement and evidence status, with a short evidence reference when available.
4. Use example details to explore the form without inventing data.
5. See recorded work portions, excluded items and specific missing-information prompts.
6. Edit, cancel changes, remove an entry, add a skipped category or restart the demo.
7. Recover from a review-service failure without losing entries in the open tab.

## Supported example

One record per category: transport fares (bus/train/taxi), a phone service bill, and a protective-clothing item. An amount may represent a single cost or a category total for Sarah's fictional 2025–26 scenario; this milestone does not verify transaction dates or prevent overlapping entries in another workflow.

| Sample | Amount | Work use | Reimbursement | Evidence | Recorded work portion |
|---|---:|---:|---|---|---:|
| Transport fares | $72.60 | 100% | None | Missing | $72.60 |
| Phone service | $600.00 | 40% | None | Available with reference | $240.00 |
| Protective clothing | $120.00 | 100% | Full | Available with reference | $0.00 |
| Total | $792.60 | | | 1 item needs attention | $312.60 |

These are organising amounts, not approved deductions or a refund estimate. Missing evidence does not silently remove an arithmetic amount: its work portion remains visible with an action. A fully reimbursed or 0%-work item contributes zero. A partly reimbursed/uncertain item has no calculated work portion until clarified; the visible subtotal is explicitly labelled partial. Reimbursement handling is a deliberately limited prototype workflow, not a complete tax rule engine.

## API contract

`POST /api/expenses/review`, JSON, no authentication or persistence in this fictional demo.

```json
{
  "expenses": [{
    "category": "phone",
    "amount": 100,
    "workUsePercent": 40,
    "purpose": "Work calls",
    "workUseBasis": "Sample usage diary",
    "reimbursement": "none",
    "evidence": "available",
    "evidenceReference": "Sample bill and diary"
  }]
}
```

The result contains `items`, `enteredTotal`, `workPortionTotal`, `unresolvedCount` and `attentionCount`. Each item has category, amount, workUsePercent, workPortion (number or null), status and actions. Status is `details-recorded`, `needs-attention` or `excluded`; none means tax eligibility has been confirmed.

Validation:

- At most 3 entries and one per supported category; an empty list is valid.
- Amount $0.01–$1,000,000 inclusive, at most 2 decimal places; whole-number work use 0–100 inclusive.
- Reimbursement: `none`, `full`, `unsure`; evidence: `available`, `missing`, `unsure`.
- Purpose and work-use basis at most 300 characters each; reference at most 120. Missing notes produce review actions instead of blocking preparation.
- Request body capped at 16,384 bytes, including when Content-Length is absent. Invalid JSON/details return 400; unsupported content type 415; oversized body 413.
- C# decimal arithmetic rounds each work portion to cents with midpoint rounding away from zero, then sums those displayed amounts.
- `Cache-Control: no-store`; request content is processed in memory and never written to application storage or logs.

## Implementation choices

The form keeps unsaved input locally, so Cancel restores the previous saved entry. The guided journey owns the saved list. The summary calls the API with that list and validates the response shape and matching entries. Each changed list starts a new summary instance, aborting the previous request and immediately removing old totals. A 15-second timeout permits retry even if the transport never settles. Restart and page refresh clear all entries.

The CSV preview remains separate. It validates transactions; it neither creates expense records nor decides their tax treatment. Developer health checks now sit in an expandable section below the user workflows.

## Verification

- API integration tests: sample totals, cent rounding, missing evidence/notes, uncertain reimbursement, full/zero-work exclusions, malformed requests, bounds and empty-list independence.
- Frontend tests: JSON contract, invalid responses, form validation/focus, skip/add/save/edit/cancel/remove, retry, timeout, restart and late-response cancellation.
- Real browser: full three-category journey, edits that change totals, unresolved reimbursement, remove/reset, manual mobile entry, focused errors, actual API interruption/recovery, plus the existing CSV flow.
- CI stores desktop/mobile screenshots, a browser JSON report and API test results in its verification artifact. See [development guide](DEVELOPMENT.md) for commands.

## Next milestone

Export the reviewed preparation summary with its evidence checklist and unresolved items, so a visitor can take away a useful result. The export must reproduce the displayed rounded amounts and clearly label partial totals. Persistence, multiple records per category, CSV-to-expense conversion, receipt uploads, own-car methods, equipment depreciation, tax eligibility and refund estimates remain separate work.
