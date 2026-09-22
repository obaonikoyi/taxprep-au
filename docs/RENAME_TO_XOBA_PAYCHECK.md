# The project is now Xoba Paycheck

Dated 22 September 2026. It was **TaxPrep AU** from the first commit until this
change.

## Why

**The name described the wrong half of the product.** "TaxPrep" says the thing
this app does last and least: it does not lodge a return, and every tax or
refund result in it is deliberately locked pending qualified review (#21, #28).
What it actually does, today, is read payslips and compare them with the pay the
user agreed to. The name pointed at the gated half.

**And the wrong half is the half that cannot leave Australia.** Tax rates, the
ATO, superannuation, income statements, a year ending 30 June, awards — none of
that crosses a border. *Hours × rate* does. Every country with shift work has
people being paid something other than what they agreed, and the arithmetic that
finds it is the same everywhere. A name built on "tax" welds the product to one
country through the part of it that is least defensible.

**A tax-sounding name is also a regulated-sounding name.** Under the Tax Agent
Services Act, advertising tax agent services without registration is an offence,
and this app is explicitly not that. A name that leans on "tax" spends its first
impression on a disclaimer.

**The old address was a stage name.** `taxprep.3xoba.com` is a subdomain of the
owner's artist name. Someone handing over their payslips should not be asked to
trust a stage name, and an identity that cannot be sold with the product should
not be welded to it. The app now answers at `xobapaycheck.com`, a domain of its
own. `taxprep.3xoba.com` stays attached to the same Railway service so existing
links keep working — see [Milestone 9](MILESTONE_9_STANDALONE_DEMO.md).

One thing the new name does not fix: **"paycheck" is American.** Australians say
*payslip* or *pay*. The product copy uses the Australian words throughout and
should keep doing so — "Understand your payslip", not "understand your
paycheck". The Americanism is confined to the brand.

## What changed

Every user-visible occurrence of the brand:

- the page title, meta description and the `T` monogram in the header, now `X`;
- the header, the navigation label and the footer disclaimer;
- every downloaded report — its `<title>`, its printed heading, and the filename
  it arrives under (`xoba-paycheck-pay-history.html` and its siblings);
- the `/api/health` service string;
- the npm package name, the CI Docker image tag;
- the whole of `docs/`, including the historical milestone records: they
  describe one product that has been renamed, not two products.

The fictional PDFs in `sample-data/user-test/` were regenerated, because the old
name was baked into their document titles.

## What deliberately did not change, and why

Each of these would cost something real and buy nothing a user can see.

**`TaxPrepAu.Api` — the .NET project, namespaces and directories.** No user ever
sees an assembly name. Renaming it means moving directories and rewriting the
solution, both `.csproj` files, every namespace and `using`, the `Dockerfile`'s
copy and publish paths, and the build workflow. C# cannot be compiled in the
container this work is done in, so every mistake would have to be found by a CI
round trip against a deploy that serves real traffic. It is a clean, separate
change and should be made as one.

**Export format identifiers.** `taxprep-expenses-v1`,
`taxprep-year-end-handoff-v1`, `taxprep-year-end-preparation-backup-v1` and
`taxprep-year-end-preparation-payload-v1` are *validated on import*. Someone who
downloaded an encrypted backup yesterday must still be able to restore it
tomorrow. A version identifier is not branding — that is precisely why it
carries a version suffix rather than a product name. They change when the format
changes.

**Browser storage keys.** `taxprep-au:preparation-progress` and `taxprep.theme`
are invisible, and renaming them would silently discard the saved progress of
anyone still arriving at `taxprep.3xoba.com`, which is still live. Storage
already belongs to an exact origin, so the move to the new domain starts
everyone fresh there anyway; there is no reason to also break the old one.

**The repository slug `obaonikoyi/taxprep-au`.** Renaming the repository is the
owner's call, not a code change. It rewrites 108 links across the docs, breaks
the `origin` remote in every existing clone, and may require relinking Railway's
GitHub source. GitHub redirects the old name, so there is no urgency.

**The Railway project name.** Cosmetic, and only visible in the owner's own
dashboard.

## Verification

410 tests, `npm run lint`, `npm run build`, `npm ci` against the renamed package,
and the browser render checks — light, dark, theme switch, mobile — all pass.
The payslip and report browser journeys were re-run end to end, because the
downloaded report filenames changed and those journeys are what actually
download them.
