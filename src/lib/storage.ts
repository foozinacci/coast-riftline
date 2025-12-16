// Local storage wrapper with JSON serialization

const STORAGE_PREFIX = 'riftline_';

export const storage = {
  get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(STORAGE_PREFIX + key);
      if (!item) return null;
      return JSON.parse(item) as T;
    } catch (e) {
      console.warn(`Failed to get storage key: ${key}`, e);
      return null;
    }
  },

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.warn(`Failed to set storage key: ${key}`, e);
    }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(STORAGE_PREFIX + key);
    } catch (e) {
      console.warn(`Failed to remove storage key: ${key}`, e);
    }
  },

  clear(): void {
    try {
      // Only clear riftline keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (e) {
      console.warn('Failed to clear storage', e);
    }
  },
};
