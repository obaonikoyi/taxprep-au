import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * The polyfill installs itself on import, so each test loads a fresh copy of
 * the module against a prototype it has arranged first.
 */
const NAMES = ['getOrInsert', 'getOrInsertComputed'] as const
const saved = new Map<string, PropertyDescriptor | undefined>()
const drop = (prototype: object, name: string) => { delete (prototype as Record<string, unknown>)[name] }
const method = (prototype: object, name: string) => (prototype as Record<string, unknown>)[name]

async function installFresh() {
  vi.resetModules()
  await import('./mapUpsert.ts')
}

beforeEach(() => {
  for (const prototype of [Map.prototype, WeakMap.prototype]) {
    for (const name of NAMES) {
      saved.set(`${prototype === Map.prototype ? 'Map' : 'WeakMap'}.${name}`, Object.getOwnPropertyDescriptor(prototype, name))
      drop(prototype, name)
    }
  }
})
afterEach(() => {
  for (const [key, descriptor] of saved) {
    const prototype = key.startsWith('Map.') ? Map.prototype : WeakMap.prototype
    const name = key.split('.')[1]
    drop(prototype, name)
    if (descriptor) Object.defineProperty(prototype, name, descriptor)
  }
  saved.clear()
})

describe('Map and WeakMap upsert methods', () => {
  // pdf.js 6.3 calls getOrInsertComputed 33 times across its bundle and its
  // worker. Chrome 141 has none of these methods, so without them reading a
  // PDF throws — and a build target cannot help, because a missing method is
  // not syntax and nothing transpiles it away.
  it('installs on both prototypes when the engine lacks them', async () => {
    for (const prototype of [Map.prototype, WeakMap.prototype]) for (const name of NAMES) expect(prototype).not.toHaveProperty(name)
    await installFresh()
    for (const prototype of [Map.prototype, WeakMap.prototype]) for (const name of NAMES) expect(typeof method(prototype, name)).toBe('function')
  })

  it('never shadows an implementation the engine already has', async () => {
    const native = () => 'the engine’s own'
    Object.defineProperty(Map.prototype, 'getOrInsertComputed', { value: native, configurable: true, writable: true })
    await installFresh()
    expect(Map.prototype.getOrInsertComputed).toBe(native)
    // The one it did lack is still installed.
    expect(typeof Map.prototype.getOrInsert).toBe('function')
  })

  it('returns what is already there, and inserts only when it is not', async () => {
    await installFresh()
    const map = new Map([['kept', 1]])
    expect(map.getOrInsert('kept', 99)).toBe(1)
    expect(map.getOrInsert('added', 2)).toBe(2)
    expect([...map]).toEqual([['kept', 1], ['added', 2]])
  })

  it('computes only for a key it does not hold', async () => {
    await installFresh()
    const map = new Map([['kept', 1]])
    const compute = vi.fn((key: string) => key.length)
    expect(map.getOrInsertComputed('kept', compute)).toBe(1)
    expect(compute).not.toHaveBeenCalled()
    expect(map.getOrInsertComputed('added', compute)).toBe(5)
    expect(compute).toHaveBeenCalledExactlyOnceWith('added')
    // A second read is served from the map, not recomputed.
    expect(map.getOrInsertComputed('added', compute)).toBe(5)
    expect(compute).toHaveBeenCalledTimes(1)
  })

  it('lets the computed value win when the callback touches the map itself', async () => {
    await installFresh()
    const map = new Map<string, string>()
    expect(map.getOrInsertComputed('key', () => { map.set('key', 'from the callback'); return 'computed' })).toBe('computed')
    expect(map.get('key')).toBe('computed')
  })

  it('refuses a callback that is not a function', async () => {
    await installFresh()
    expect(() => new Map().getOrInsertComputed('key', 'not callable' as unknown as () => unknown)).toThrow(TypeError)
  })

  it('works on a WeakMap, whose keys are objects', async () => {
    await installFresh()
    const weak = new WeakMap<object, number>(), key = {}
    expect(weak.getOrInsertComputed(key, () => 7)).toBe(7)
    expect(weak.get(key)).toBe(7)
    expect(weak.getOrInsert(key, 99)).toBe(7)
  })

  it('stays out of the way of anything enumerating a map', async () => {
    await installFresh()
    expect(Object.keys(Map.prototype)).toEqual([])
    expect(Object.propertyIsEnumerable.call(Map.prototype, 'getOrInsertComputed')).toBe(false)
  })
})
