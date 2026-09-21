# Milestone 18 — the agreed pay rate, and the questions it raises

Status: engineering implemented, minus the two parts held back below. Extends the payslip work under [#35](https://github.com/obaonikoyi/taxprep-au/issues/35).

## User outcome

Today TaxPrep can tell a user what their payslip *says*. It cannot tell them whether the payslip says the right thing, because it has never been told what the user was promised.

This milestone records the pay rate the user agreed to — from a contract, letter of offer, or roster certificate — and then checks every confirmed payslip against it. Where a payslip disagrees with the agreed rate, or disagrees with its own arithmetic, TaxPrep shows the calculation side by side and states the difference in dollars.

> **Pay rate on this payslip**
> Your record says **$28.90/hour** (contract, from 1 July 2026).
> This payslip shows **38.00 hours at $27.50** = $1,045.00.
> At the rate you recorded, 38.00 hours is **$1,098.20** — a difference of **$53.20** for this period.
> TaxPrep cannot tell you which figure is correct. Ask your employer's payroll contact about this period, and keep this payslip.

That is the whole feature: a specific, dated, arithmetic question the user can take to someone. It is not a verdict.

## Why this one

Every other part of TaxPrep helps a person *record* what happened. This is the first part that helps them *challenge* it, and it is the only part that pays for itself before tax time — an underpayment caught in August is worth more than a tidier return in October.

It is also the sharpest differentiator the product has. Payroll software checks pay from the employer's side. The Fair Work pay calculator answers "what does my award pay?" but never sees a payslip. Income trackers such as TaxTank record what arrived. Nothing in the surveyed set closes the loop the worker actually cares about: *the thing I signed, versus the thing I was paid.*

Consistent with [product direction](PRODUCT_DIRECTION.md), that is stated here as **the differentiation hypothesis to test**, not as an established market claim. The test is in [Verification](#verification-plan): can a user who suspects something is wrong produce a specific, dated, arithmetic question within one session?

## The distinction this milestone lives or dies on

TaxPrep checks the payslip against **what the user says they agreed to**. It does not check the payslip against **what the law requires**.

Those are different questions and only the first one is answerable from documents on the user's device:

| Question | Who can answer it | TaxPrep |
|---|---|---|
| Does this payslip match the rate in my contract? | arithmetic | **yes, this milestone** |
| Does this payslip add up on its own terms? | arithmetic | **yes, this milestone** |
| Is the rate in my contract lawful for my award and classification? | Fair Work / a qualified adviser | **no, and it must never imply otherwise** |
| Am I legally being underpaid? | Fair Work Ombudsman, a union, a lawyer | **no** |
| Did my super actually reach my fund? | the fund, the ATO | **no** ([Milestone 14](MILESTONE_14_PAYSLIP_DASHBOARD.md) already says so) |

A contract can be below an award minimum and TaxPrep would see nothing wrong, because TaxPrep has no award, classification, age, hours-band or penalty-rate knowledge and this milestone does not add any. The product direction's existing rule applies in full: *"a payslip's arithmetic can be checked without proving wage entitlement or employer compliance … use specific questions and checks, not a blanket green 'correct payslip' verdict."*

Every finding therefore carries the same three-part shape — **what your record says · what the payslip says · the difference** — and ends in a question, never a conclusion. The words "underpaid", "unlawful", "owed" and "wage theft" do not appear in any generated string. The findings panel is headed **Questions to ask**, and it names the Fair Work Ombudsman as where to take them, without characterising the user's situation.

## What gets recorded

A **rate record** is the user's own statement of what they agreed to. It is entered once per employer and survives only as long as the session, exactly like every other fact in this workspace.

| Field | Notes |
|---|---|
| Employer | Matched to payslips by the existing `employerKey` normalisation |
| Rate | AUD per hour, or per year for a salary |
| Basis | `hourly` \| `annual` |
| Ordinary hours per week | Required for an annual salary; optional for hourly |
| Effective from | A rate that started mid-year must not be applied to earlier payslips |
| Effective to | Optional; set when a later rate supersedes it |
| Source | `contract` \| `letter of offer` \| `roster or certificate` \| `verbal, recorded by me` |
| Source note | Free text, e.g. "clause 4.1, signed 12 June 2026" |

Several records per employer are allowed and are the normal case — a pay rise is a second record with a later *effective from*. A payslip is checked against the record whose date range contains its **period start**. A payslip that falls in no record's range is not checked, and says so.

`verbal, recorded by me` is deliberately offered. It is weaker evidence and is labelled as such wherever a finding cites it, but a user who was told a number and never given paper is precisely the user this feature exists for.

## What a payslip has to say for a check to run

The two layouts TaxPrep reads today ([v1 labelled summary](MILESTONE_14_PAYSLIP_DASHBOARD.md), [v2 tabular pay advice](MILESTONE_17_SECOND_PAYSLIP_LAYOUT.md)) carry gross, withheld, deductions, net and super. **Neither carries hours or an hourly rate.** Without those, three of the five checks below cannot run at all.

This milestone therefore adds:

1. **Two optional fields** — `hours` and `rate` — to `PayFacts`, blank by default. Blank is a normal, permanent state, not an error, and never blocks confirmation.
2. **An earnings-lines reader for v2.** A tabular pay advice usually carries an earnings block above the totals:

   ```
   Earnings          Hours      Rate      This pay    Year to date
   Ordinary hours    38.00     28.90      1,098.20       32,946.00
   ```

   The column-anchoring rule from Milestone 17 extends to it unchanged: anchors come from the header row, amounts are matched to a column by the **centre** of the token, and the year-to-date column is never read. `Hours` and `Rate` become two more anchored columns.
3. **A third documented layout, `PAY ADVICE v3`**, identical to v2 plus that earnings block. It shares v2's parser outright: a v2 advice has no earnings header, so the block reads nothing and v2's behaviour is untouched, which its existing suite proves.

   The reader anchors on the header row exactly as Milestone 17 does, but with four columns rather than two, and rejects a figure that does not sit clearly under one of them. Both the earnings header and the totals header carry the words "This pay" and "Year to date"; the two are told apart by the earnings header also carrying "Hours".

The example payslips in the guided journey now state their hours and rate too, so the checks can be seen without uploading anything. The fourth Harbour payslip drops from $30.00 to $28.50 an hour with nothing recorded to explain it — a payslip that is perfectly consistent with itself and still worth a question.

A payslip with several earnings lines — ordinary, overtime, penalty, allowance — has **only its ordinary-hours line** checked against the agreed rate. Overtime and penalty multipliers depend on the award and the roster, which TaxPrep does not know. The other lines are displayed, totalled and explicitly excluded from the check, with the reason shown.

## The checks

Each runs only when everything it needs is present and confirmed. Amounts are integer cents and hours integer hundredths throughout, as elsewhere in the codebase. `hours × rate` is computed in those units and rounded half-up to the cent once, at the end.

**Payroll systems round differently and legitimately.** A difference of **2 cents or less per period is treated as rounding and produces no finding.** Anything larger is shown with its exact value.

### 1 · The payslip does not match the rate you recorded

*Needs: a rate record covering the period, plus hours and rate on the payslip.*

Compares the payslip's stated rate to the recorded rate, and separately the payslip's ordinary-line amount to `hours × recorded rate`.

> 38.00 hours at $27.50 = $1,045.00. At the $28.90 you recorded, that is $1,098.20 — **$53.20 less than your record implies**.

**Cannot conclude:** that $28.90 is the correct rate. The contract may have been superseded, the classification may have changed, or the record may be wrong. All three are offered as possibilities.

### 2 · The payslip does not agree with itself

*Needs: hours, rate and the ordinary-line amount on the payslip. **No rate record required.***

> This payslip shows 38.00 hours at $28.90, which is $1,098.20, but the ordinary line reads **$1,080.00** — a difference of **$18.20**.

This is the "point out the inconsistencies" check, and it is the most valuable one in the set because it needs nothing from the user at all. It joins the existing gross − withheld − deductions ≠ net check in `validateFacts`.

**Cannot conclude:** anything about entitlement. An unshown adjustment, a correction from a previous period, or unpaid leave can all produce this legitimately — so the finding says so.

### 3 · Your rate changed without a change being recorded

*Needs: two confirmed payslips from one employer with rates stated.*

> Your rate was **$28.90** on the payslip for the period ending 12 Aug 2026 and **$27.90** on the period ending 26 Aug 2026. You have not recorded a rate change between these dates.

Offers two actions side by side: record a rate change (if the user knew about it), or keep it as a question (if they did not).

**Cannot conclude:** that the change was improper. Classification changes, the end of a casual loading arrangement and roster changes all move a rate lawfully.

### 4 · Hours paid are fewer than hours you recorded — **not built**

Deferred, as the open questions below anticipated. An hours log is a second
data-entry surface with its own model, and the three checks above are useful
without it. It stays listed here so the decision is visible rather than
forgotten.

### 5 · Super looks low against the payslip's ordinary earnings — **gated**

*Needs: a reviewed super-guarantee percentage for the financial year.*

**This check ships disabled.** It requires a percentage that changes by year and must come through the source register described in [product direction](PRODUCT_DIRECTION.md) — URL, applicable year, retrieved content and hash, review status, worked examples — on exactly the same footing as the gates in [#21](https://github.com/obaonikoyi/taxprep-au/issues/21) and [#28](https://github.com/obaonikoyi/taxprep-au/issues/28).

It carries a second, independent problem: **ordinary time earnings are not gross pay.** Overtime is generally excluded, some allowances are not, and getting that wrong produces a confident, plausible and wrong number about someone's retirement savings. The check stays behind the gate until both the rate and the OTE definition are reviewed, and the UI says that is why rather than hiding it.

## When nothing is checked, the product says so

A silent check is worse than no check: a user who sees no findings will conclude they were paid correctly. Every payslip therefore carries an explicit **checked / not checked** state with the reason.

| Situation | What the user sees |
|---|---|
| No rate record for this employer | "Add the rate from your contract to check these payslips." |
| Record exists, but its dates do not cover this period | "Your $28.90 record starts 1 July 2026; this period ends 24 June 2026. Add the earlier rate to check it." |
| Payslip states no hours or rate | "This payslip does not show hours or a rate, so it cannot be checked against your contract. You can type them in from the original." |
| Payslip not yet confirmed | "Check this payslip's figures first." |
| Everything present, nothing found | "Checked the hours and rate on this payslip against each other, and this payslip's rate against $28.90 an hour from your contract." — never a tick, never the word "correct" |

The last row is the one to get right. TaxPrep names *what it compared*, and nothing beyond it. A payslip can be partly checked: one that states hours and a rate but falls outside every rate record still has its own arithmetic tested, and the note says so.

## Privacy

A contract is a more sensitive document than a payslip: it carries salary, signature, address and often a name that is not the user's. The existing rules apply without exception, and one is added:

- Reading happens in the browser; nothing is uploaded and no model sees a contract.
- **TaxPrep stores the extracted rate, not the contract.** The file is read, the fields are offered for confirmation, and the document is dropped. A rate record holds numbers, dates and the user's own source note.
- No real contract, payslip or certificate enters the repository, fixtures, CI, telemetry or the published examples. Every test fixture is invented, as all existing ones are.
- Rate records leave the device only through the paths that already exist and already require an explicit user action: the downloaded report, the [portable handoff](MILESTONE_16C2_PORTABLE_HANDOFF.md) and the [encrypted local backup](MILESTONE_16C3_ENCRYPTED_LOCAL_BACKUP.md).

## In the report

The downloaded report gains a **Pay rate checks** section: the rate records used with their sources and date ranges, each finding with its full arithmetic and period, and — explicitly — every payslip that was *not* checked and why. A report that lists only findings would let a reader infer that everything else was verified.

The section carries the same framing as the screen: questions, the three-part arithmetic, and no characterisation of the employer.

**One difference from the screen, deliberately.** The panel looks at every payslip in the session whatever filters are set, so a filter can never hide a question. The report's section is scoped to the report's own filters, because a report is a document someone sends on and one scoped to a single employer must not name another. Both say which of the two they are doing, and a test holds the report to it.

## Verification plan

Engineering checks only. These do not constitute payroll, industrial-relations or tax approval.

Thirty tests in `payRate.test.ts`, on top of the 364 already passing.

- Three invented `PAY ADVICE v3` fixtures driven through real pdf.js bytes, as Milestone 17's are: one whose ordinary line agrees with its own hours and rate, one paid below an agreed rate, and one that disagrees with itself *and* carries an overtime line.
- Column reading: hours, rate and amount are each anchored by token centre; the overtime line's 4.00 hours at $43.35 never reaches any field; no year-to-date figure reaches any field; and the three v2 advices come back with hours, rate and ordinary pay all blank, so Milestone 17's layout is provably untouched.
- Arithmetic in integer units against hand-computed expectations, including the rounding band at its boundaries (2 cents produces nothing, 3 cents produces a finding), a rate effective mid-period, a salary converted before comparison, and a payslip falling in no record's range.
- The same sum is never raised twice: when a payslip's stated rate matches the record, the amount comparison stands down because the self-check already tests it.
- A test asserting that **no generated string contains** "underpaid", "unlawful", "owed", "wage theft", "correct" or six other conclusions — the safety property, enforced rather than reviewed — across a fixture that produces all four kinds of finding at once.
- A test that every payslip carries a check state with a reason, so silence can never be mistaken for a pass, and a test that a filtered report never names an employer outside its scope.
- The hosted payslip smoke script uploads all three v3 advices, reads the hours and rate off the form, confirms the self-inconsistency finding appears with no rate recorded at all, then records a rate and confirms the rate difference, its $53.20 arithmetic and the silent rate change appear on screen and in the downloaded report — which must also carry the "what was not checked" table and no year-to-date figure.
- **Still outstanding — the differentiation test, with people, not code:** give a user a contract and four payslips, one of which is short. Can they produce the specific dated question within one session, unaided? Measure it before any claim about this feature is published.

## Not included

- **Award, classification, penalty and overtime rates.** No lookup, no inference, no "your award says". Overtime and penalty lines are displayed and excluded from the check.
- **Any legal characterisation.** TaxPrep points at the Fair Work Ombudsman; it does not describe the user's situation.
- **AI contract reading.** The user-facing ask is real and it is the natural next step, but it is deliberately not in this milestone — see below.
- **The hours log** (check 4), deferred as above.
- **The super check**, until a reviewed SG percentage and a reviewed OTE definition exist.
- **Persistence.** Rate records are session-only, like everything else in this workspace.
- Any change to the tax and refund gates in [#21](https://github.com/obaonikoyi/taxprep-au/issues/21) and [#28](https://github.com/obaonikoyi/taxprep-au/issues/28).

## 18B — reading the contract automatically, later

Typing a rate from a contract takes fifteen seconds; getting it wrong quietly poisons every check built on top of it. So the deterministic path ships first and the assisted path follows, once it can be built to the same standard as the rest of the product:

- Extraction happens on-device, or the operating-model work in [product direction](PRODUCT_DIRECTION.md) — provider handling, access control, encryption, retention, deletion and log redaction — is done first. A contract must not be the first document TaxPrep ever uploads.
- A contract is **untrusted data**, exactly as the product direction requires of document content. Text inside it never becomes an instruction.
- Every extracted field arrives as a **candidate** next to the clause it came from, and the user confirms it. This is the same discipline the payslip reader already follows, and it is what makes a wrong read visible instead of silent.
- A confidence score is not a substitute for confirmation, and no extracted rate is ever used unconfirmed.

Until then: manual entry, clearly labelled, with the source recorded.

## Open questions

1. **Salary → hourly.** Converting an annual salary needs ordinary weekly hours and a convention for weeks in a year. The convention has to be stated on screen, because it changes the answer.
2. **Casual loading.** A casual rate often quotes the loaded figure; a contract may quote the base. Asking the user which one they recorded is probably unavoidable.
3. ~~**Scope of the hours log** (check 4).~~ Resolved by shipping checks 1–3 without it.
4. **Where the feature lives.** It is a panel under the pay summary, which is where someone who has just checked their payslips is standing. Whether it deserves its own step in the journey is worth revisiting once someone has used it.
5. **Two findings, one payslip.** A payslip that is both below the recorded rate and the first at a changed rate raises two questions about the same period. Both are true and distinct, and they are shown separately. Whether that reads as thorough or as noise is a question for the user test.
