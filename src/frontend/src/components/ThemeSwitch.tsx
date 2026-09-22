import { useEffect, useState } from 'react'
import { activeTheme, chooseTheme, watchTheme, type Theme } from '../lib/theme'

/*
 * Light or dark, chosen in the header rather than in the operating system.
 *
 * Two buttons rather than one toggle: a single button has to say either the
 * state it is in or the state it would move to, and on a finance page that
 * ambiguity costs more than the extra 40 pixels. `aria-pressed` marks the
 * one in force, so a screen reader announces the current scheme rather than
 * an instruction.
 */
const OPTIONS: [Theme, string][] = [['light', 'Light'], ['dark', 'Dark']]

export default function ThemeSwitch() {
  // `lib/theme.ts` already applied a scheme before React rendered; this only
  // mirrors it, and follows the device until the user picks for themselves.
  const [theme, setTheme] = useState<Theme>(activeTheme)
  useEffect(() => watchTheme(setTheme), [])

  return (
    <div className="theme-switch" role="group" aria-label="Page colours">
      {OPTIONS.map(([key, label]) => (
        <button key={key} type="button" aria-pressed={theme === key} onClick={() => chooseTheme(key)}>{label}</button>
      ))}
    </div>
  )
}
