/*
 * The methods `src/lib/mapUpsert.ts` guarantees are present, whatever the
 * engine shipped with. `lib` targets ES2023, which predates them, so without
 * this every use reads as an error even though the polyfill has installed it.
 *
 * Two things about this file are deliberate and easy to undo by accident:
 * `declare global` is needed rather than a bare interface, because
 * `moduleDetection` is `force` and a top-level interface here would be local
 * to this file and augment nothing; and the name is kept apart from
 * `mapUpsert.ts`, because a `foo.d.ts` sitting beside a `foo.ts` is read as
 * that file's own declarations and contributes nothing global at all.
 *
 * Declared to match the language proposal: the computed form takes the key and
 * returns the value to store.
 */
export {}

declare global {
  interface Map<K, V> {
    getOrInsert(key: K, value: V): V
    getOrInsertComputed(key: K, callback: (key: K) => V): V
  }

  interface WeakMap<K extends WeakKey, V> {
    getOrInsert(key: K, value: V): V
    getOrInsertComputed(key: K, callback: (key: K) => V): V
  }
}
