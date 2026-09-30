/**
 * Minimal key-value seam. The ONLY place in the app that touches
 * `window.localStorage` is `browserStore()`; everything else goes through a
 * `KeyValueStore` (tests use `MemoryStore`).
 */
export interface KeyValueStore {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
  keys(): string[]
}

export class MemoryStore implements KeyValueStore {
  private map = new Map<string, string>()
  get(key: string) { return this.map.get(key) ?? null }
  set(key: string, value: string) { this.map.set(key, value) }
  remove(key: string) { this.map.delete(key) }
  keys() { return [...this.map.keys()] }
}

/** localStorage-backed store; falls back to memory when storage is unavailable. */
export function browserStore(): KeyValueStore {
  try {
    const ls = globalThis.localStorage
    if (!ls) return new MemoryStore()
    const probe = '__tt_probe__'
    ls.setItem(probe, '1')
    ls.removeItem(probe)
    return {
      get: (k) => ls.getItem(k),
      set: (k, v) => ls.setItem(k, v),
      remove: (k) => ls.removeItem(k),
      keys: () => Array.from({ length: ls.length }, (_, i) => ls.key(i)).filter((k): k is string => k !== null),
    }
  } catch {
    return new MemoryStore()
  }
}
