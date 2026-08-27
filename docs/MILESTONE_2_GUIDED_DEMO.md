# Milestone 2 — Guided demo journey

## Objective

Create a five-minute, portfolio-friendly demonstration of TaxPrep AU using fictional data. A visitor should understand the problem, complete a short guided flow and reach a useful preparation summary without creating an account or entering sensitive information.

## User story

> As a portfolio visitor, I want to try a ready-made tax-preparation scenario so that I can understand TaxPrep AU quickly and safely.

## First vertical slice

1. Start the fictional Sarah profile.
2. Confirm sample employment income and tax withheld.
3. Answer conditional questions for workplace travel, phone use and protective clothing.
4. See which categories need more review and which are not applicable.
5. Restart the demonstration.

## Acceptance criteria

- The demo is clearly labelled as fictional.
- No account, TFN, myGov login or real financial information is requested.
- Progress is visible throughout the journey.
- Keyboard-accessible buttons perform every interaction.
- Typed React state records the answers.
- The layout works on desktop and mobile widths.
- The final screen explains that results are preparation prompts, not approved deductions.
- Frontend lint and production build pass.

## Deferred work

- Entering expense amounts and work-use percentages.
- Recording receipts and other evidence.
- Calling the ASP.NET Core API.
- Calculation of estimates.
- Exporting the preparation summary.
- ATO, myGov, banking or identity integrations.

These are separate increments so each change remains small, testable and reviewable.
