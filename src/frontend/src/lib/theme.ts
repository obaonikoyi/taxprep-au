/*
 * Light or dark, and who gets to decide.
 *
 * The scheme used to come straight from `prefers-color-scheme`, so a user
 * whose laptop is set to dark had no way to read Xoba Paycheck in light. People
 * reading columns of figures often want the opposite of their system default,
 * and on a shared or borrowed laptop they cannot change the system setting
 * anyway.
 *
 * So the scheme now lives on `<html data-theme>` and `tokens.css` keys off
 * that attribute instead of the media query. The device preference is still
 * the default: it is read here and written to the attribute. That keeps one
 * copy of the dark palette in CSS rather than two — a media query and an
 * attribute override cannot share a declaration block, and duplicating sixty
 * colours is how a palette drifts out of step with itself.
 *
 * Until the user picks, the device still leads: a laptop that turns dark at
 * sunset takes the page with it. The first click ends that and is remembered.
 */

export type Theme = 'light' | 'dark'

// The `taxprep.` prefix outlives the rename to Xoba Paycheck: a storage key
// belongs to an exact origin, and renaming it would throw away the choice of
// anyone still arriving at taxprep.3xoba.com, which is still live.
// See docs/RENAME_TO_XOBA_PAYCHECK.md.
const KEY = 'taxprep.theme'
const DARK = '(prefers-color-scheme: dark)'
const watchers = new Set<(theme: Theme) => void>()

/** What the device asks for, right now. */
export function deviceTheme(): Theme {
  return window.matchMedia?.(DARK).matches ? 'dark' : 'light'
}

/**
 * The choice the user made on a previous visit, or null if they never made
 * one. Reading storage throws outright in some private-browsing modes, so a
 * failure here means "no choice", never a broken page.
 */
export function storedTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  } catch { return null }
}

/** The scheme in force: the user's choice if they made one, else the device's. */
export const activeTheme = (): Theme => storedTheme() ?? deviceTheme()

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme
  for (const watcher of watchers) watcher(theme)
}

/** Record the user's choice and switch to it. The device no longer leads. */
export function chooseTheme(theme: Theme) {
  // A tab that cannot write storage still gets the scheme it asked for; it
  // just will not remember it next time.
  try { window.localStorage.setItem(KEY, theme) } catch { /* this tab only */ }
  apply(theme)
}

/** Tell a component when the scheme changes. Returns the unsubscribe. */
export function watchTheme(watcher: (theme: Theme) => void) {
  watchers.add(watcher)
  return () => { watchers.delete(watcher) }
}

/**
 * Put the scheme in place before the app renders, and follow the device for
 * as long as the user has not chosen. Call once, at startup.
 */
export function startTheme() {
  apply(activeTheme())
  window.matchMedia?.(DARK).addEventListener?.('change', event => {
    if (storedTheme() === null) apply(event.matches ? 'dark' : 'light')
  })
}
