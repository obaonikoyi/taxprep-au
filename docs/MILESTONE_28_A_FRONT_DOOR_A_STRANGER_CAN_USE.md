# Milestone 28 — a front door a stranger can use

Status: **built.** No configuration, no key, on for everyone.

## How it was found

The person who owns this app opened it, chose a payslip, and nothing happened.

Not "nothing useful". Nothing. He reported it as the app ignoring him. It was
not ignoring him — it had answered, clearly and specifically, in a message
rendered **427 pixels above the top of his window**, with the page left where it
was and the keyboard focus left on `<body>`:

```
errorBox.y  = -427px
errorInView = false
focus       = BODY
scrollY     = unchanged
```

Reproduced in a real browser before a line was changed. The app was right and
invisible, which is worse than wrong and visible: a wrong answer can be argued
with, an unseen one teaches the person that the button does not work.

## The two faults

**The answer was out of sight.** Every message this screen produces — errors,
skipped files, anything — renders above the start card. The file picker is near
the bottom of that card. So by the time anyone is in a position to choose a
file, the place the app replies is off the screen, and nothing scrolls, and
nothing takes focus.

**The way in was the way out.** The card led with a primary button marked *Enter
figures manually* — typing twelve figures off a page by hand, presented as the
main event. The thing most people actually want, handing over the file, was a
pale secondary button below a paragraph about "three documented layouts" and a
checkbox carrying five lines of small print. To do the easy thing you first had
to read past the hard thing and understand a word — *layout* — that nobody
arrives knowing. Nobody arrives knowing what a layout is. They arrive holding a
payslip.

## What it does now

The card asks for the payslip, and that is all it asks for:

> ### Start with your payslip
> Add your payslip and it fills in the figures. You check them, then you see
> your pay.
>
> **[ Choose your payslip ]**
> A PDF, or a photo taken on your phone. Your file stays on this device.
>
> No file to hand? *Type the figures in yourself*

The privacy checkbox is gone from this screen. Not the consent — the checkbox.

## Where the consent went

It used to be asked up front, before anything had happened, so that nobody could
consent to something they had already done. That principle is intact and better
served. Choosing a file sends nothing: the layouts are tried here, on the
device. Only when none of them match is anything asked, and then it is asked
about **these files, by name**:

> **Your payslip is set out in a way this app has not seen before**
> - PaySlip.pdf
>
> Nothing has left your device. There are two ways forward, and both end with
> you checking every figure.
>
> **Type the figures in yourself** — Nothing is sent anywhere at all.
> **Let our reader try** — The *words* of this payslip are sent to our server to
> be read; never the file, and never a picture of it. Nothing is stored. The
> reading comes back for you to check, and no figure counts until you confirm it.
>
> [ Let our reader try ]  [ Type the figures in myself ]

This is a stronger consent than the checkbox was, not a weaker one. It names the
file. It is asked at the moment it applies. It cannot be left ticked from
earlier in the session and forgotten. And it is unreachable until the device has
already tried and failed, so the question is never rhetorical.

| | Before | Now |
|---|---|---|
| Asked | Before choosing any file | When a layout is not recognised |
| About | Files in general, forever | These files, by name |
| Wording | "For a layout this app does not know…" | "Set out in a way this app has not seen before" |
| If you say no | Nothing, silently | The figures screen, ready to type into |
| Sent before you answer | Nothing | Nothing |

## The rule this establishes

**Anything this screen says brings the page to it.** Errors, skipped files and
the question all render inside one focusable region that is scrolled into view
and given the keyboard the moment it has something to say. An answer nobody can
see is not an answer.

## What is checked

| Invariant | How |
|---|---|
| Nothing is read without asking | The journey chooses an unknown layout with nothing stubbed and asserts the request count for the run is unchanged |
| The question is on the screen | `boundingBox().y` is asserted inside the viewport, not merely present in the DOM |
| The question has the keyboard | `document.activeElement.className === 'pay-alerts'` |
| The question names the file | The panel's text contains the file name |
| Declining leads somewhere | "Type the figures in myself" reaches the figures screen with empty fields |
| Accepting reads it | "Let our reader try" reaches the confirm stage, unconfirmed |
| An unrecognised layout stays knowable | `isUnknownLayout` is asserted directly, so the wording can improve without the behaviour drifting |

The geometry assertions are the point. A test that only checked the words would
have passed on the original bug.

### The first version of that test proved nothing

Deleting the `scrollIntoView` and re-running it **passed**. Not because the
scroll does not matter, but because the redesign had already moved the file
picker to the top of the card, so the test was choosing a file from a page that
was barely scrolled — and from there the answer lands on the screen whether
anything scrolls or not. The assertion was real and the scenario was not.

The scenario now scrolls to the bottom of the page first, which is where
somebody ends up after opening "What files can I use?", and is the state the
original report came from. With that, both mutations are caught:

| Mutation | Result |
|---|---|
| Remove `scrollIntoView` | `y = -1235` in an 844px window — **caught** |
| Remove `focus()` | `activeElement.className` empty — **caught** |

Measured on a phone-sized window, which is the harder case and the likelier one.

## Deliberately unchanged

- **The bank statement screen still asks up front.** There is no on-device
  layout to try first there, so the question cannot be deferred to a failure
  that never comes. `.pay-assist-choice` stays for it.
- **No colours changed.**
- **Typing the figures in is still a first-class path.** A paper payslip is a
  real thing. It is offered as an alternative rather than presented as the
  entrance.
- **The layout names are no longer shown when a read fails.** *PAYSLIP SUMMARY
  v1 and PAY ADVICE v2* told nobody anything they could act on. The example
  files are still downloadable, now described as "a simple one" and "one with a
  table".

## Still open

The reading itself remains narrow: a payslip with penalty rates — afternoon,
Saturday, Sunday, public holiday — has its ordinary line read and the rest
ignored. On a real shift worker's payslip that is nine percent of the money.
That is Milestone 29, next, and it is the larger of the two.
