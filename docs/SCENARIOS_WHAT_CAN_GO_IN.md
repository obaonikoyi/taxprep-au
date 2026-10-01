# What can go in, and what should happen

A catalogue of what people actually hand an app like this, what Xoba Paycheck
does with each today, and what it ought to do. Written before building, so the
decisions are arguments rather than accidents.

It exists because the reading has got good enough to be dangerous. An app that
refuses everything is useless and an app that accepts everything is worse, and
most of the interesting cases are neither a clean payslip nor an obvious reject.

## The rule that decides every case

> **The model may say what a document is. It may never be the only thing that
> says so.**

Everything below follows from that. Where a wrong answer is cheap and visible —
"this looks like a tax return, not a payslip" — a model's judgement is enough,
because the person sees it immediately and can disagree. Where a wrong answer is
expensive and invisible — a figure that joins a year's total, a rate that every
payslip is compared against — something that is not the model has to agree:
arithmetic, the document's own text, or the person.

"Smart" in this app means **recognising what it is looking at and saying so**.
It does not mean guessing harder.

---

## A. It is not a document we can read

| Scenario | What happens today | Verdict |
|---|---|---|
| A video, `.mp4` | Refused on the file name before anything is read | **Right** |
| A video renamed `payslip.pdf` | Refused: the first five bytes are not `%PDF-` | **Right** |
| A 40 MB scan | Refused: 2 MB for PDF, 5 MB for a picture | **Right** |
| A 60-page PDF | Refused: payslips are one page | **Right** |
| A password-protected PDF | pdf.js throws; the file is named as unreadable, the batch keeps the rest | **Right** |
| A blank or all-white scan | No text recognised; says so and offers manual entry | **Right** |

Nothing to build. This layer is honest and cheap, and it runs before anything
costs money.

---

## B. It is a document, but not a payslip

This is the first real gap.

| Scenario | What happens today |
|---|---|
| A tax return (notice of assessment) | **Probably accepted.** It has a name, an ABN, dates and dollar amounts. The reader is asked for twelve payslip fields and will find plausible candidates |
| A bank statement | Likely partly read — an "employer", dates, amounts |
| An invoice or a receipt | Same |
| A page of numbers with no labels | Likely returns blanks, and blanks are refused |
| A novel | Returns blanks, refused |

**The only guard today is "all twelve fields came back empty."** That is a guard
against nonsense, not against the wrong document. A notice of assessment is not
nonsense; it is a tax document full of exactly the shapes a payslip reader is
hunting for.

### What should happen

The reader should be asked **what the document is before it is asked what it
says**, and that answer should be visible:

> **This does not look like a payslip.**
> It looks like an ATO notice of assessment. Xoba Paycheck reads payslips — a
> document showing one pay period, with gross pay, tax withheld and net pay.
>
> `[ Read it as a payslip anyway ]`  `[ Choose a different file ]`

Three things make that safe:

1. **The person can overrule it.** A payslip in an unusual format must not be
   locked out by a classifier's opinion, so refusal is never final.
2. **It is cheap.** The classification comes back in the same call as the
   reading, so it costs no extra request and no extra budget unit.
3. **It never silently drops anything.** Saying "this is a tax return" and
   stopping is a visible outcome. Reading it as a payslip and producing an
   employer called "Australian Taxation Office" with a gross of $0 is not.

**A tax return deserves its own sentence**, because it is the most likely wrong
document and the most alarming one to have misread: *"This looks like a tax
return. Those figures are a whole year, not one pay period — adding them to your
pay history would count a year as a fortnight."*

---

## C. It is a payslip, but not yours

The scenario put most directly: *what if I put my contract and another person
puts that contract?*

**Xoba Paycheck has no idea who you are.** Nothing reads the employee's name.
Nothing compares it across documents. There is no account, no profile, no
identity of any kind — which is a deliberate privacy decision and is also why
this gap exists.

Consequences today:

| Scenario | What happens |
|---|---|
| Your payslip and a colleague's, same employer | **Both accepted, both summed.** The total is two people's pay |
| A contract that is not yours | Its rate becomes the baseline every payslip is compared against |
| A payslip you were sent by mistake | Accepted |

Nothing here is caught, because nothing is looking.

### What should happen

**Not an identity check.** This app does not know who you are and should not
start, and a name on a payslip is personal data the app has so far deliberately
never kept.

What it can do is notice **disagreement between the documents in front of it**:

> **These payslips name two different people.**
> *PaySlip (1).pdf* is made out to one name and *PaySlip (2).pdf* to another.
> A pay summary that mixes two people's pay is wrong in a way nothing here can
> detect later.
>
> `[ Keep only the first ]`  `[ Keep only the second ]`  `[ Keep both anyway ]`

The names are compared and then **thrown away** — never stored, never shown
beside the figures, never in the downloaded report. The check is "do these two
documents disagree", not "who is this".

Same for a contract: if the contract names a different person from the payslips,
say so **before** its rate becomes the baseline for a run of findings.

This is the single largest correctness gap in the app, and it is the one a
reviewer would find first.

---

## D. It is yours, but not from now — or not from that job

### Two jobs at once

The case from life: a disability support job and another job, about $3 an hour
apart.

**This already works, and it is one of the better-built parts.** Employers are
kept separate throughout: the summary has an employer filter, totals are
per-employer, and a recorded rate belongs to one employer and is only ever
compared against that employer's payslips. Two jobs at two rates produce two
sets of findings, not one confused set.

The failure mode is narrower and real: **the same job spelled two ways.**
Employer matching is literal, after lowercasing and collapsing spaces. So:

| On the payslip | Treated as |
|---|---|
| `Care Squad Unit Trust` / `CARE SQUAD UNIT TRUST` | the same employer |
| `Care Squad Unit Trust` / `Care Squad` | **two different employers** |
| `Care Squad Unit Trust` / `Care Squad Unit Trust Pty Ltd` | **two different employers** |

A person with one job then sees two columns, two sets of totals, and a recorded
rate that only matches half their payslips — with no explanation.

**What should happen:** when two employer names are close but not equal, ask.

> **Are these the same employer?**
> *Care Squad Unit Trust* and *Care Squad* appear on different payslips.
> `[ Same employer ]`  `[ Different employers ]`

Not automatic merging. Two genuinely different employers can have similar names,
and silently merging them would merge two jobs' pay.

### A payslip from twenty years ago

Any date between 2000 and 2100 is accepted. A 2006 payslip and a 2026 payslip
both load, and they fall into different financial years, so **nothing is
miscounted** — the year filter keeps them apart and the totals are per year.

So the arithmetic is right. What is missing is the remark:

> This payslip is from the **2006–07** financial year. Your others are from
> **2026–27**. It is kept and counted in its own year.

And the rate check should refuse to compare across a gap like that, rather than
report that a 2006 rate differs from a 2026 one as though it were a shortfall.
A rate record already has a date range, so a payslip outside every record's range
should produce *no finding*, not a wrong one. **Worth testing explicitly — it is
exactly the shape of a false accusation.**

### A corrected payslip, reissued

Same employer, same period, same pay date, different figures. Today this is
**refused as a duplicate** — "Another entry already has this employer, pay date
and period." The message does say to remove the superseded one first, so there is
a way through, but it is backwards: the person is told their corrected payslip is
a duplicate.

**What should happen:** notice the figures differ and offer the swap.

> This payslip covers a period you already have, with **different figures**.
> `[ Replace the earlier one ]`  `[ Keep both ]`  `[ Cancel ]`

---

## E. Ten at once, and one of them is wrong

Already answered, and answered well — this was Milestones 21 and 28. Ten files
where one is a holiday photo:

- the nine that read are **kept** and go to the confirm step;
- the photo is **named**, with the reason, in a list of what was not added;
- a file in a layout nobody documents becomes a **question** about that file by
  name, not a failure;
- nothing is cancelled, and nothing is silently dropped.

A batch used to be all or nothing — one bad file threw away every payslip read
beside it. It is not any more, and a journey test puts all three outcomes in one
batch to keep it that way.

**The one thing to add** is the B and C checks above, per file: nine payslips
kept, one named as "this looks like a tax return", one named as "this names a
different person" — each on its own line, the rest unaffected.

---

## F. The quiet ones

The dangerous cases are not the weird documents. They are the ones that read
perfectly and mean something other than what the app assumes.

| Scenario | Risk | Status |
|---|---|---|
| **Year-to-date column read as this period** | A fortnight's pay becomes a year's. The single worst failure in the app | **Handled**, and at three levels: the prompt leads with it, v2/v3 layouts read only the *This pay* column, and the journey asserts YTD figures never reach a field |
| **A final pay with leave and termination payouts** | Looks like an enormous fortnight; distorts averages and any forecast | **Not handled.** Nothing notices a pay period that is wildly unlike its neighbours |
| **Back pay or an adjustment** | Same shape | **Not handled** |
| **A payslip in another currency** | Figures accepted as AUD | **Not handled.** Nothing looks for a currency marker |
| **A partial first or last period** | Low gross reads as a shortfall against a recorded rate | **Not handled** — and this *can* produce a wrong finding, so it ranks above the others |
| **Two payslips, overlapping periods** | Pay counted twice | Partly handled: identical period and pay date is caught, overlapping-but-different is not |

The partial-period one deserves attention first, because it is the only entry
here that turns into a question the person might put to their employer.

---

## What I would build, in order

1. **Does this document name a different person?** (C) — the largest gap, and
   the only one where the app is confidently wrong rather than merely quiet.
   Names compared, never stored.
2. **Is this a payslip at all?** (B) — classify in the same call, say so plainly,
   let the person overrule, and give a tax return its own sentence.
3. **No finding across a period nothing covers** (D) — a payslip outside every
   recorded rate's dates must produce no comparison. Cheap, and it prevents a
   false accusation.
4. **Is this the same employer under two names?** (D) — ask, never merge.
5. **A corrected payslip is a replacement, not a duplicate** (D).
6. **A period unlike its neighbours gets a remark, not a finding** (F) — final
   pay, back pay, a partial period.

1 and 2 belong together: both are "what is this document", both come back in the
reading that already happens, and both end in a sentence the person can overrule.

## What this document does not propose

- **No identity, no accounts, no stored names.** Comparing two documents in front
  of you is not the same as knowing who you are, and the second one is not coming.
- **No automatic merging of anything** — not employers, not duplicates, not
  periods. Every one of these ends in a question.
- **No refusal the person cannot overrule.** A classifier that locks somebody out
  of their own unusual payslip is a worse failure than one that lets a tax return
  through with a warning attached.
