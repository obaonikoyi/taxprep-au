# Milestone 22 — a payslip that is a picture

Status: **built.** On for everyone, with no key and no configuration.

## Why

A payslip had to be a PDF whose own text could be extracted. That is not what
people have. They have a photo on their phone, or a scan their employer emailed,
or a screenshot from a payroll portal — and the app's answer to all three was
*enter those figures yourself*, twelve fields at a time.

## What it does

A PNG or JPG is read by recognising the words in the picture. A PDF with no
text of its own — which is what a scan is — is rendered and read the same way
rather than refused.

From there **nothing is different**. The same documented parsers read it, the
same confirm screen shows it, the same arithmetic checks run on it, and no
figure reaches a chart or total until the person has confirmed it.

## Nothing new leaves the device

The recogniser is the one this app already runs for receipts and annual income
statements: WebAssembly served from this origin, working on a canvas in the
browser. The picture is not uploaded, and the payslip journey asserts that the
whole run — including this one — makes no request that is not a GET.

This was worth stating plainly because "the app reads my photo" sounds like the
app sends the photo somewhere. It does not, and nothing about the
Content-Security-Policy changed to allow this.

## The one thing that had to be got right

Recognising the drawn marker `PAYSLIP SUMMARY v1` gives back **`PAYSLIP SUMMARY
vl`** — a lowercase L where the digit 1 should be. Every figure on that same
payslip came back correct: employer, both period dates, the pay date, gross,
withheld, deductions, net. One character, in the one place that decides which
parser reads the payslip.

So a marker read from a picture is compared through the handful of
substitutions a recogniser actually makes (`O`/`Q`/`D`→0, `L`/`I`/`|`→1,
`S`→5, `B`→8, `Z`→2, `G`→6). **Nothing else is loosened.** Field labels and
every value are still matched exactly, and a label that is misread leaves its
field blank for the person to fill in — which is the behaviour the confirm
screen already exists for.

The tolerance is narrow on purpose, because a marker matched too eagerly would
hand a payslip to a parser that does not understand it. `PAYSLIP SUMMARY v1`
and `PAY ADVICE v2` differ by far more than those characters, and tests assert
both that the tolerance works and that it refuses `PAYSLIP SUMMARY`,
`PAYSLIP SUMMARY v12` and an unrelated line.

## Where the figures came from is on the screen

A recognised figure deserves a second look more than an extracted one, so the
review screen says **"Recognised from your picture — check every figure"** in
place of "Read from your PDF".

While there: a payslip read by asking a model used to render its layout as
nothing at all, because `formatLabel` only knew the documented layouts. The one
reading with most reason to be looked at twice was the one saying least about
itself. It now reads *"a layout we do not document, read for you"*.

## Verification

- **The payslip journey, end to end in a real browser against a local container
  serving the real build.** A fictional payslip drawn as a PNG is recognised in
  about two seconds, read by the documented parser, and **every field matches
  the fixture exactly** — employer, both dates, pay date, gross, withheld,
  deductions and net. The journey's existing assertion that it makes no request
  other than a GET still holds with this block in it.
- 8 tests over the recogniser's answer: positions kept, coordinates flipped so a
  word near the top has the larger `y`, the recogniser's own line grouping used
  rather than the height tolerance that suits a PDF, a word with no usable
  position dropped rather than placed at zero, and an answer of the wrong shape
  returning nothing rather than throwing.
- Tests for the marker tolerance in both directions: that `PAYSLIP SUMMARY vl`
  is read, and that it never becomes a different layout or accepts a non-marker.
- `sample-data/payslips/generate_photo_example.py` draws the fixture cleanly
  rather than photographing it badly, because a test that depends on how a
  recogniser copes with a crooked, shadowed phone photo fails for reasons that
  have nothing to do with this app.

## Limits, said plainly

- **A recogniser misreads things.** It read this fixture perfectly and it will
  not do that every time. The person checking every field is the control, as it
  has been for every reading this app has ever produced — and a misread that
  breaks a payslip's own arithmetic is still caught by the confirmation checks.
- **The fixture is drawn, not photographed.** Nothing here measures accuracy on
  a real phone photo of a real payslip in bad light. That is the
  [Milestone 18 user test](USER_TEST_MILESTONE_18.md)'s job, and it has still
  not been run.
- **One page.** A multi-page scan is still refused, as a multi-page PDF is.
- **HEIC is not read.** iPhones produce it by default. The browser cannot decode
  it without another decoder, and photos shared or exported from an iPhone are
  normally JPG.
- **A deadline of three minutes per file**, up from one. Recognising a picture is
  seconds of work, the first one also fetches the recogniser, and a PDF that
  turns out to be a scan cannot be told apart from one that is not until it has
  been opened. The deadline is there to stop a hang, not to hurry anybody.
