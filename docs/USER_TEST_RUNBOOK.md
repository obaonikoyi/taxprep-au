# User test runbook — everything you need on the day

The experiment is [designed here](USER_TEST_MILESTONE_18.md): what is being
tested, what counts as a pass, and what each outcome means. **Read that first.**
This is the part you carry: what to send, what to say, what to write down.

Four participants, about 40 minutes each. One person can run it alone.

---

## 1. Before the day

- [ ] Regenerate the materials: `python3 sample-data/user-test/generate_kit.py`
- [ ] Put the five PDFs in one folder on the laptop you will hand over, named
      `contract.pdf`, `payslip-1.pdf` … `payslip-4.pdf`, and nothing else.
- [ ] **Print `payslip-4.pdf`** on paper. That is for task 2.
- [ ] Open `https://xobapaycheck.com` in a normal browser window. Not private
      browsing — a participant may reload, and you want the real behaviour.
- [ ] Check it loads and the "Try example payslips" button works. Then **clear
      the example history** so they start on a blank screen.
- [ ] **Run the kit check against the site you are about to use:**

      cd src/frontend && DEMO_URL=https://xobapaycheck.com npm run test:user-kit

      It drives the whole kit through a real browser and prints `"kit": "ready"`,
      or tells you what has stopped working. It takes about a minute and it is
      the difference between finding a problem now and finding it in front of a
      participant.
- [ ] Have this runbook printed, or on a second device. Not on the laptop they
      are using.
- [ ] Decide who is facilitating. It cannot be whoever built the thing, if
      there is anyone else at all — you will hint without meaning to.

**Checked on 23 September 2026** against a local build of the current `main`
(commit `f9b177a`) — not against the live site, which could not be reached from
where the check was run. All four payslips are read as `PAY ADVICE v3`, none
needs a correction, and both routes end where the design document says they do.
**Run the check against the live site yourself**, per the box above; that is the
one that counts.

---

## 2. Recruiting

Four people. Not developers, not accountants, nobody who has seen this app.
Skew toward casual or shift work with hours that vary — hospitality, retail,
care.

Send this:

> Hi — I've built a small tool for checking payslips and I need four people to
> try it, so I can find out whether it actually makes sense to anyone who isn't
> me.
>
> It takes about 40 minutes. You'd be looking at a made-up person's payslips,
> not your own — you don't need to bring anything, and nothing of yours gets
> shared or recorded.
>
> It isn't a test of you. I'm trying to find the parts that don't work, so
> getting stuck is genuinely the useful bit. Any chance you're free [when]?

---

## 3. Say this before you start

Read it out. It takes thirty seconds and it settles two things that otherwise
go wrong.

> Before we start, three things.
>
> One — everything you're about to look at is made up. A made-up employer, a
> made-up person, made-up amounts. **Please don't use your own payslips or
> anything real of yours**, even if you have them on your phone. I don't want
> your financial information and this doesn't need it.
>
> Two — I'm not recording this. I'll write notes about what happens on the
> screen, not about you, and nothing with your name on it goes anywhere.
>
> Three — I'm testing the thing, not you. If you get stuck, that's the most
> useful thing that can happen, so please don't push through quietly. Say what
> you're thinking as you go if you can. And you can stop whenever you want, for
> any reason, and it's fine.
>
> Any questions before we start?

---

## 4. Task 1 — the main one

Hand over the laptop with the folder open. Say this and **nothing more**:

> These are your payslips for the last two months, and this is your employment
> contract. You have a feeling you have been paid less than you should have
> been, but you are not sure. Have a look and tell me what you find. Use the
> website however you want. I am not going to help, and there are no wrong
> answers — if you get stuck, that is useful to me.

Then be quiet. Do not point. Do not hint. Do not answer "where do I click" —
say *"whatever you think makes sense."* **Stop at 20 minutes** whether or not
they got there.

Start the clock when they touch the laptop.

---

## 5. Task 2 — the photograph (optional, 5 minutes)

Only after task 1 is finished and you have asked the three questions below.
Skip it if they are out of time or do not want to use their phone.

This is the part of the app **nobody has ever tested on a real photograph.**
Everything that works today was proved on a file drawn by a computer.

Hand them the printed `payslip-4.pdf` and say:

> Last thing. Take a photo of this piece of paper with your phone, get it onto
> this laptop however you'd normally do that, and see if the site will read it.

Let them work out the transfer themselves — that friction is part of the
finding. Write down:

- Did the photo get read at all, or was it refused?
- Which figures came out wrong, if any? (The right answers are on your sheet.)
- How long did the whole thing take, transfer included?
- Would they do this again, or would they type the figures?

A refusal or a wrong figure here is **not a failure of task 1** and does not
change the pass/fail bar. Record it separately.

---

## 6. Ask these three, only at the end

After they stop, or after 20 minutes. In this order, and do not soften them:

1. *"How sure are you that what you found is right?"*
2. *"What would you do with this?"*
3. *"Was there a point where you nearly gave up?"*

Question 2 is the one that matters most. The product exists to produce a
message someone actually sends. "I'd show my manager" is a pass. "I'd want to
check it with someone first" is not, and it is the most useful sentence this
test can produce.

---

## 7. Recording sheet

One per participant. Print four.

```
Participant #____        Date ____________     Facilitator ____________

Works in ................................ (industry, hours pattern)
Has looked at their own payslip and wondered?   yes / no

TASK 1
  Route taken .................. A (app raised the rate change)
                                 B (they entered the contract)
                                 neither
  First sign something was wrong ........... ____ min
  Complete question .......................... ____ min
    Period stated?           2026-08-12 to 2026-08-25     yes / no
    Rate difference stated?  $30.75 vs $32.50             yes / no
    Dollar figure stated?    $108.50, or $1.75 an hour    yes / no
  Unaided?                                                yes / no
  Where they stalled (screen, and what they tried)
  ......................................................................
  ......................................................................
  Their own words for what they found (verbatim)
  ......................................................................
  ......................................................................

THE THREE QUESTIONS
  How sure are you it's right? ..........................................
  What would you do with this? ..........................................
  Nearly gave up? .......................................................

TASK 2 — PHOTOGRAPH (optional)
  Read at all?                                            yes / no
  Figures wrong .........................................................
    (correct: 62.00 h · $30.75 · gross $1,906.50 · period 2026-08-12 to 2026-08-25)
  Minutes, transfer included ............ ____
  Do it again, or type it? ..............................................

ANYTHING ELSE
  ......................................................................
  ......................................................................
```

---

## 8. Afterwards

Do this the same day, while you still remember the tone.

1. Write all four up — **including the failures and the verbatim quotes** —
   into [the design document](USER_TEST_MILESTONE_18.md) under a `## Result`
   heading, dated.
2. Count the routes. If most passes came via route A, say so plainly: the
   contract feature was not what did the work.
3. Update the differentiation paragraph in [product direction](PRODUCT_DIRECTION.md),
   which calls this a hypothesis, to say what was observed.
4. Write the photograph findings into
   [Milestone 22](MILESTONE_22_PAYSLIP_AS_A_PICTURE.md) under
   *"Limits, said plainly"*, which currently says nothing here has been
   measured on a real photo.

**Do not keep the notes with names on them.** Participant numbers are enough,
and the point of the test is in what happened on the screen.

If it fails, that is the point of running it. A feature nobody can use is
cheaper to find out about now than after it has been built on.
