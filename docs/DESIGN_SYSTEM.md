# TaxPrep AU — interface design system

How the four workspaces (My pay, Bank spending, Tax documents, Guided example) stay visually consistent, and where to add a style rather than inventing one.

## Why this exists

Each milestone previously shipped its own stylesheet. The same patterns were rebuilt every time with slightly different values, so by Milestone 16C-1 the app contained **287 distinct hex colours across 855 lines of CSS** — roughly one new colour for every three lines. There were 13 variants of "a title with an action on the right", 17 variants of a bordered callout, 11 badges and 10 stat grids. Nothing was wrong on any single screen; there was simply no way to change anything once.

The layers below replace that with one source of truth. Adding a raw hex value, or a new copy of an existing pattern, should now be a deliberate decision rather than the path of least resistance.

## The layers

Stylesheets load from `src/index.css` in a fixed order. Load order used to depend on which workspace the visitor opened first, because each lazily loaded component imported its own CSS; `payslips.css` carried a block of overrides written to work around exactly that. Everything is imported in one place now, so the cascade is the same on every page load.

| Layer | File | Holds |
|---|---|---|
| 1. Tokens | `src/styles/tokens.css` | Colour ramps, semantic roles, space, radius, type, elevation, motion, the dark scheme |
| 2. Primitives | `src/styles/primitives.css` | Buttons, badges, callouts, stat grids, split headings, form grids, focus ring, card surfaces |
| 3. Shell | `src/App.css` | Header, workspace tabs, footer, hero, the guided demo |
| 4. Workspaces | `src/features/*/*.css` | Only what is specific to that workspace |

**Rule of thumb:** if a rule would read the same in two workspaces, it belongs in layer 2. If it names a colour, a gap or a font size directly, it belongs in layer 1 first.

## Tokens

Colour is declared as a small set of ramps (`--green-*`, `--grey-*`, `--amber-*`, `--clay-*`, `--blue-*`), and then as **semantic roles** that the rest of the app actually uses:

- Surfaces — `--page`, `--surface`, `--surface-sunken`, `--surface-inverse`
- Text — `--ink`, `--ink-body`, `--ink-muted`, `--ink-subtle`, `--ink-inverse`
- Lines — `--line`, `--line-strong`, `--line-soft`
- Brand — `--brand`, `--brand-hover`, `--brand-deep`, `--brand-ink`, `--brand-tint`, `--brand-tint-strong`, `--brand-line`
- Intents — `--warn-*` (needs checking), `--alert-*` (something is wrong), `--info-*` (neutral information)

Use the role, not the ramp. `--ink-muted` survives a palette change; `--grey-600` does not.

Space is a 4px scale (`--space-1` … `--space-10`), and type a named scale (`--text-2xs` … `--text-3xl`). Both exist so spacing and sizing decisions are made once.

### Dark scheme

`@media (prefers-color-scheme: dark)` redefines the *roles* only — the ramps stay put, and the brand ramp is re-pointed so mid greens stay legible on a dark surface. Because every rule reads roles, the dark scheme is about forty lines rather than a second stylesheet. `prefers-reduced-motion` is honoured globally in the same file.

## Primitives

The milestone class names are kept — markup and tests refer to them — but they are aliases onto one definition. `.pay-outlook-heading`, `.year-end-heading`, `.tax-readiness-heading` and ten others are the same split-heading rule; `.year-end-lock`, `.pay-checks`, `.notice` and fourteen others are the same callout with an intent. Changing the pattern changes all of them.

New UI should reuse an existing alias list rather than adding a name. If a genuinely new pattern is needed, define it in `primitives.css` with the other primitives.

### Emphasis is explicit, never positional

One figure in a stat row can carry emphasis, marked with `className="metric-feature"`. It used to be `:first-child` in one stylesheet and `:nth-child(2)` in another, which meant loading both promoted two cards at once. Mark the element; do not style by its position.

## Charts

Series colours are tokens (`--chart-1` earnings, `--chart-2` take-home and super, `--chart-3` tax withheld), assigned by series identity and never by rank. Each mode has its own validated step rather than an automatic flip of the light values. Both sets pass the lightness band, chroma floor, colour-vision-deficiency separation, normal-vision separation and surface-contrast checks; the pay chart also carries a legend and a dashed second series, so identity is never colour alone, and every chart has an exact-figures table beneath it.

Grid lines and axis labels use `--chart-grid` and `--ink-muted`.

## One deliberate exception

`src/features/reports/report.css` keeps literal hex values. It is inlined into the downloaded HTML report (`report.css?raw`), which is a standalone document with no access to the app's tokens, and which people print or send to an accountant — so it should not follow a dark scheme either. Keep it in step with the tokens by hand.

## Checking a change

```bash
cd src/frontend
npm test                   # unit and component tests
npm run lint
npm run build
npm run test:ui            # renders every workspace in both schemes in a real browser
```

`npm run test:ui` (`scripts/ui-smoke.mjs`) needs no backend. It checks that no workspace logs an error, that token-driven chart colours resolve to real colours, that exactly one metric per row is emphasised, that the shell does not stack two page headings, and that a 390px-wide phone has no horizontal scroll. It runs in CI after the API smoke test. Set `CHROMIUM_PATH` to reuse an already-installed browser.
