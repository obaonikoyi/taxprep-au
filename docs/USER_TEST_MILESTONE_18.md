# User test — can someone produce the question?

Status: materials built and piloted. **The test itself has not been run**, because it needs four people and cannot be run by the person who built the thing.

[Milestone 18](MILESTONE_18_AGREED_PAY_RATE.md) ends with a test it does not run:

> Give a user a contract and four payslips, one of which is short. Can they produce the specific dated question within one session, unaided? Measure it before any claim about this feature is published.

This document turns that sentence into something you can run on a Saturday.

## The claim under test

That Xoba Paycheck closes a loop nothing else does: **the thing I signed, versus the thing I was paid.** Everything written about that so far is a hypothesis. Until four people who did not build it can get from *"something feels off"* to *"on the fortnight ending 25 August I was paid $30.75 an hour instead of the $32.50 in my contract — that's $108.50"*, the claim is unverified and should not be published.

## Materials

`sample-data/user-test/files/`, regenerate with `python3 sample-data/user-test/generate_kit.py`.

| File | What it is |
|---|---|
| `contract.pdf` | A fictional casual hospitality contract. Clause 4.1: **$32.50/hour from 1 July 2026**. |
| `payslip-1.pdf` | 60.00 h at $32.50 = $1,950.00 |
| `payslip-2.pdf` | 64.00 h at $32.50 = $2,080.00 |
| `payslip-3.pdf` | 58.00 h at $32.50 = $1,885.00 |
| `payslip-4.pdf` | **62.00 h at $30.75 = $1,906.50** — at the agreed rate this fortnight would be $2,015.00 |

Everything is invented. No real employer, employee or agreement.

**$1.75 an hour is chosen to be hard.** Payslip 4's own hours and rate multiply out correctly, so nothing about it looks wrong on its face. The hours vary every fortnight, so the gross figure moving around is normal and tells you nothing. Only a comparison against the contract — or against the earlier payslips — finds it. A gap large enough to spot by glancing at the net pay would test nothing.

### Piloted, so you are not debugging in front of a participant

Driven end to end before this was written: all four PDFs are recognised as `PAY ADVICE v3`, hours and rate are filled in automatically, all four confirm with **no corrections needed**, and recording the $32.50 rate produces exactly:

> **$1.75 an hour below what you recorded, or $108.50 over this period.** — Kestrel Example Hospitality · 2026-08-12 to 2026-08-25

If a participant cannot get there, that is a finding about the product, not about the materials.

## There are two routes, and which one they take is the result

The pilot turned up something the test has to account for. **Before the contract is entered at all**, Xoba Paycheck already raises the silent rate change between payslips 3 and 4 — the rate moved and nothing recorded a reason.

So there are two paths to the answer:

- **Route A — the app noticed.** They upload the payslips, and the app hands them the rate change without the contract being involved.
- **Route B — they noticed.** They read the contract, record $32.50, and the app converts that into the dollar figure.

Both end at a usable question, so both count as a pass for *"can they produce it"*. But they say completely different things about the differentiator. If everyone succeeds via Route A, the contract feature — the part that is supposedly unique — was not what did the work, and that is worth knowing before anyone builds more of it.

**Record the route for every participant.** It is the most interesting number this test produces.

## Recruiting

Four people. Not developers, not accountants, not anyone who has seen Xoba Paycheck.

Skew toward people the product is for: casual or shift work, variable hours, hospitality or retail or care work, someone who has actually looked at a payslip and wondered. Adelaide is convenient, not required.

Four is not statistical significance and is not meant to be. Four people will tell you whether this is usable at all. If three of four cannot do it, you do not need a fifth.

## Running it

**Setup (before they arrive).** Open `https://xobapaycheck.com` on a laptop you hand over. Have the five PDFs in one folder, named as above. A fresh browser tab — the session clears on refresh, so a previous run cannot leak in.

**Say this, and nothing more:**

> These are your payslips for the last two months, and this is your employment contract. You have a feeling you have been paid less than you should have been, but you are not sure. Have a look and tell me what you find. Use the website however you want. I am not going to help, and there are no wrong answers — if you get stuck, that is useful to me.

**Then be quiet.** Do not point, do not hint, do not answer questions about where to click. If they ask, say "whatever you think makes sense." Stop at 20 minutes.

## Record these

| | |
|---|---|
| Route taken | A (app raised the rate change) / B (entered the contract) / neither |
| Minutes to first sign something was wrong | |
| Minutes to the complete question | Period **and** rate difference **and** a dollar figure |
| Did they get there unaided? | yes / no |
| Where they stalled | The exact screen, and what they tried |
| Their words for what they found | Verbatim. This is what tells you if the framing landed. |
| Did they believe it? | Ask: *"How sure are you this is right?"* |
| Would they send it? | Ask: *"What would you do with this?"* — the real outcome is a message to payroll, not a screen |

Ask the last three **only after** they stop or the 20 minutes are up.

## The bar, set now so it is not rationalised later

**Pass:** at least **3 of 4** participants, unaided, within 20 minutes, state something containing all three of:

1. the fortnight ending **25 August 2026**;
2. that the rate was **$30.75** rather than the **$32.50** in the contract;
3. a dollar figure — **$108.50** for the period, or **$1.75** an hour.

**Fail:** two or more cannot, or reach a number they cannot explain, or say they would not send it because they do not trust it.

A pass on the task but a fail on *"would you send it"* is still a fail. The product exists to produce a question someone actually asks.

## What each outcome means

- **3–4 pass via Route B.** The differentiation hypothesis survives its first contact with people. It can be written about as something observed, still not as a market claim.
- **3–4 pass, but mostly via Route A.** The product works; the *contract* feature is not what made it work. Before building more of it, test whether it earns its place.
- **2 or fewer pass.** The feature does not do its job yet. The record of where they stalled is the next milestone.
- **They pass but would not send it.** The arithmetic is fine and the framing is not. That is a wording problem, and a cheap one to fix.

## Then

Write the result — all four participants, including the failures and the verbatim quotes — into this document under a `## Result` heading, dated. Then update the differentiation paragraph in [product direction](PRODUCT_DIRECTION.md), which currently calls this a hypothesis, to say what was actually observed.

If it fails, that is the point of running it. A feature nobody can use is cheaper to find out about now than after it has been built on.
