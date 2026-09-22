// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { activeTheme, chooseTheme, deviceTheme, startTheme, storedTheme, watchTheme } from './theme'

/*
 * The device preference and localStorage are both browser state this module
 * reads, so each test arranges them and puts them back afterwards.
 */
const KEY = 'taxprep.theme'
let listeners: ((event: { matches: boolean }) => void)[] = []

/** Stand in for the device's `prefers-color-scheme`, and let a test change it. */
function device(prefersDark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: prefersDark && query === '(prefers-color-scheme: dark)',
    addEventListener: (_: string, listener: (event: { matches: boolean }) => void) => { listeners.push(listener) },
  }))
}
const deviceChangesTo = (dark: boolean) => { for (const listener of listeners) listener({ matches: dark }) }

beforeEach(() => {
  listeners = []
  window.localStorage.removeItem(KEY)
  delete document.documentElement.dataset.theme
  device(false)
})
afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.removeItem(KEY)
})

describe('choosing light or dark', () => {
  it('reads the device preference when the user has never chosen', () => {
    expect(storedTheme()).toBe(null)
    expect(deviceTheme()).toBe('light')
    device(true)
    expect(deviceTheme()).toBe('dark')
    expect(activeTheme()).toBe('dark')
  })

  it('puts the scheme on the document before anything renders', () => {
    device(true)
    startTheme()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  // The whole point of the switch: a laptop set to dark must not force a
  // finance page to be dark.
  it('lets the user override the device, and remembers it', () => {
    device(true)
    startTheme()
    chooseTheme('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(window.localStorage.getItem(KEY)).toBe('light')
    expect(activeTheme()).toBe('light')
  })

  it('follows the device until the user chooses, and not after', () => {
    startTheme()
    expect(document.documentElement.dataset.theme).toBe('light')
    deviceChangesTo(true)
    expect(document.documentElement.dataset.theme).toBe('dark')

    chooseTheme('light')
    deviceChangesTo(true)
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('tells watchers the scheme changed, until they unsubscribe', () => {
    const seen = vi.fn()
    const stop = watchTheme(seen)
    chooseTheme('dark')
    expect(seen).toHaveBeenCalledExactlyOnceWith('dark')
    stop()
    chooseTheme('light')
    expect(seen).toHaveBeenCalledTimes(1)
  })

  it('ignores a stored value that is not a scheme', () => {
    window.localStorage.setItem(KEY, 'midnight')
    expect(storedTheme()).toBe(null)
    device(true)
    expect(activeTheme()).toBe('dark')
  })

  // Private browsing can throw on both reads and writes. A page that cannot
  // remember the choice must still honour it for this tab.
  it('survives storage that throws', () => {
    const storage = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')!
    Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
    try {
      expect(storedTheme()).toBe(null)
      expect(() => chooseTheme('dark')).not.toThrow()
      expect(document.documentElement.dataset.theme).toBe('dark')
    } finally {
      Object.defineProperty(window, 'localStorage', original)
    }
  })

  // Some engines have matchMedia without addEventListener, and a test
  // environment may have no matchMedia at all. Neither may take the app down.
  it('starts on an engine with no matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(() => startTheme()).not.toThrow()
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
