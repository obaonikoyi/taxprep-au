/*
 * `getOrInsert` and `getOrInsertComputed` for Map and WeakMap, installed only
 * where the engine does not already have them.
 *
 * pdf.js 6.3 calls `getOrInsertComputed` thirty-three times across its main
 * bundle and its worker, and `getOrInsert` once. Those methods are a recent
 * addition to the language: Chrome 141 has none of them. Without this, reading
 * a PDF throws `this[#t].getOrInsertComputed is not a function` on any engine
 * that predates them — and which documents reach that code path is not
 * predictable, so the payslip reader can work while the receipt reader dies on
 * the same browser.
 *
 * A build target cannot fix this. These are runtime methods rather than
 * syntax, and nothing transpiles a method that is simply absent.
 *
 * The pdf.js worker needs them too and cannot import from the app, so
 * `scripts/prepare-document-assets.mjs` transpiles this file and prepends it
 * to the copied worker. One source, two places it has to hold.
 */

// `defineProperty` rather than assignment, so the methods land non-enumerable
// as a real implementation would, and never shadow a native one.
function define(prototype: object, name: string, method: unknown) {
  if (Object.getOwnPropertyDescriptor(prototype, name) === undefined) {
    Object.defineProperty(prototype, name, { value: method, writable: true, enumerable: false, configurable: true })
  }
}

function getOrInsert(this: any, key: unknown, value: unknown) {
  if (this.has(key)) return this.get(key)
  this.set(key, value)
  return value
}

function getOrInsertComputed(this: any, key: unknown, callback: unknown) {
  if (typeof callback !== 'function') throw new TypeError('The callback must be a function.')
  if (this.has(key)) return this.get(key)
  // The callback may itself touch this map. The computed value still wins,
  // which is what an unconditional set after the call gives us.
  const value = callback(key)
  this.set(key, value)
  return value
}

for (const prototype of [Map.prototype, WeakMap.prototype]) {
  define(prototype, 'getOrInsert', getOrInsert)
  define(prototype, 'getOrInsertComputed', getOrInsertComputed)
}
