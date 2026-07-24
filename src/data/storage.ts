export interface KeyValueStore {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
}

/** Wraps JSON (de)serialization defensively — corrupt/unavailable storage degrades to `null`, never throws. */
export function createLocalStorageStore(): KeyValueStore {
  return {
    get<T>(key: string): T | null {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return null;
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    },
    set<T>(key: string, value: T): void {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Storage full or unavailable — nothing else this app can do about it.
      }
    },
  };
}
