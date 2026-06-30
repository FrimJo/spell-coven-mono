// Node can expose an unusable localStorage shim when no storage file is set.
// Give jsdom tests a deterministic implementation in that environment.
if (typeof globalThis.localStorage?.setItem !== 'function') {
  const values = new Map<string, string>()
  const storage: Storage = {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key)
    },
    setItem: (key, value) => {
      values.set(key, String(value))
    },
  }

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage,
  })
}
