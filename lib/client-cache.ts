type CacheEntry<T> = {
  value: T;
  timestamp: number;
};

const cache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 60_000;

export const getCached = <T>(key: string, ttlMs = DEFAULT_TTL_MS): T | null => {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }
  if (Date.now() - entry.timestamp > ttlMs) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
};

export const setCached = <T>(key: string, value: T): void => {
  cache.set(key, { value, timestamp: Date.now() });
};

export const clearCached = (key: string): void => {
  cache.delete(key);
};
