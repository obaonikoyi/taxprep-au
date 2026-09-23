# Milestone 21 — a batch keeps what it read

Status: **built.**

## Why

Adding payslips was all or nothing. Choose twenty, have the fourteenth fail, and
the thirteen already read were thrown away along with it. The person saw one
sentence about the file that failed and an empty history.

That was always wrong, and two changes since made it likely rather than rare:

- **The assisted reader takes seconds per file.** A batch of twenty unknown
  layouts is twenty round trips to a model, which is longer than the single
  sixty-second deadline the whole batch used to share. The deadline would cut
  off work that was going perfectly well, and everything read so far went with
  it.
- **[The read limits](MILESTONE_20_READ_LIMITS.md) refuse reads by design.** A
  refusal is now an ordinary, expected answer. An ordinary answer must not
  destroy the person's work.

## What changed

**Each file is judged on its own.** A file that cannot be read, is already
added, repeats an employer and period, or would pass the hundred-payslip limit
is set aside. Everything else is added.

**Nothing is set aside quietly.** Files that were not added are listed by name
with the reason, beside the message saying how many were read:

> **2 of those files were not added.**
> The rest were read and are waiting for you to check them. Add these again on
> their own, or enter their figures by hand.
> - torn.pdf — The selected file is not a PDF.
> - march.pdf — This file has already been added.

**A minute per file, not per batch.** One deadline across a batch was already
tight for twenty PDFs and is wrong once an unknown layout is read by asking a
server. A file that stalls now fails on its own and the rest carry on.

**Nothing readable means nothing added,** and that still reads as a plain
failure with the first reason — which is what a single file that cannot be read
has always done, and should keep doing.

## Two decisions that could have gone the other way

**Duplicates are no longer refused as a batch.** `appendPayslips` used to throw
*"No files from this batch were added"* on the first repeat. That was a clear
rule, and it cost nineteen good files for one repeat. A repeat is now one file
set aside with a reason. The rules for what counts as a repeat — same bytes, or
same employer with the same pay date and period — are unchanged.

**Cancelling still discards.** The Cancel button says *"Existing payslips are
unchanged"*, and someone who cancels because they picked the wrong folder should
not be left holding it. A deadline is not a cancellation and no longer behaves
like one; pressing Cancel is a decision, and it is kept.

## Verification

- The payslip journey, end to end in a real browser, now uploads a batch where
  one file cannot be read at all: the unreadable one is named with its reason,
  the payslip beside it is kept, and the proposal lands in the confirm stage.
- The same journey still proves a batch where **nothing** could be read leaves
  the existing history exactly as it was, and that a duplicate is refused.
- **Mutation-checked against the running app:** restoring all-or-nothing makes
  the journey fail. The browser assertion is real, not decorative.
- Unit tests over each rule for setting a file aside, including that nineteen
  files survive one repeat and that the session limit names the file it cost.
- 428 frontend tests, lint, build, and the full hosted journey against a local
  container serving the real build.

## Not done

- **A file set aside is not retried for you.** The person adds it again, or
  enters it by hand. Retrying a rate-limited read automatically would mean
  holding the file and a timer, and deciding when to give up — worth doing once
  there is evidence anyone needs it.
- **The list is not sorted or grouped.** Twenty failures would print twenty
  lines. Batches are capped at twenty files, so the worst case is bounded and
  ugly rather than unbounded.
