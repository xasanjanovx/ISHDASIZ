/** Optional browser preferences, never an authentication source. */
export function createBrowserPreferenceStore<T>(key: string, initial: T, parse: (value: unknown) => T, serialize: (value: T) => string = JSON.stringify) {
  const server = { value: initial, ready: false };
  let snapshot = server, lastRaw: string | null | undefined, memoryOnly = false;
  const listeners = new Set<() => void>();
  const decode = (raw: string | null): T => {
    if (raw === null) return initial;
    try { return parse(JSON.parse(raw)); } catch { return parse(raw); }
  };
  const getSnapshot = () => {
    if (typeof window === 'undefined') return server;
    if (!memoryOnly) {
      try {
        const raw = window.localStorage.getItem(key);
        if (!snapshot.ready || raw !== lastRaw) { lastRaw = raw; snapshot = { value: decode(raw), ready: true }; }
      } catch { memoryOnly = true; }
    }
    if (!snapshot.ready) snapshot = { value: initial, ready: true };
    return snapshot;
  };
  const notify = () => { for (const listener of Array.from(listeners)) listener(); };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== key && event.key !== null) return;
    try { if (event.storageArea && event.storageArea !== window.localStorage) return; } catch { /* Optional storage. */ }
    memoryOnly = false; lastRaw = undefined; snapshot = { value: initial, ready: true };
    getSnapshot(); notify();
  };
  const subscribe = (listener: () => void) => {
    if (!listeners.size) window.addEventListener('storage', onStorage);
    listeners.add(listener);
    return () => { listeners.delete(listener); if (!listeners.size) window.removeEventListener('storage', onStorage); };
  };
  const update = (updater: (current: T) => T) => {
    const value = parse(updater(getSnapshot().value)), raw = serialize(value);
    snapshot = { value, ready: true }; lastRaw = raw;
    try { window.localStorage.setItem(key, raw); memoryOnly = false; } catch { memoryOnly = true; }
    notify();
  };
  const clear = () => {
    snapshot = { value: initial, ready: true }; lastRaw = null;
    try { window.localStorage.removeItem(key); memoryOnly = false; } catch { memoryOnly = true; }
    notify();
  };
  return { getSnapshot, getServerSnapshot: () => server, subscribe, update, clear };
}
