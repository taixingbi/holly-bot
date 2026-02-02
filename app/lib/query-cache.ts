/**
 * In-memory cache for chat responses.
 * Normalizes queries (lowercase, trim, collapse spaces) so similar questions hit the cache.
 */

const MAX_ENTRIES = 500;

function normalize(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[?!.,;:'"]/g, "");
}

const cache = new Map<string, { response: string; at: number }>();

function evictOldest() {
  if (cache.size < MAX_ENTRIES) return;
  let oldestKey: string | null = null;
  let oldestAt = Infinity;
  for (const [k, v] of cache) {
    if (v.at < oldestAt) {
      oldestAt = v.at;
      oldestKey = k;
    }
  }
  if (oldestKey) cache.delete(oldestKey);
}

export function getCachedResponse(message: string): string | null {
  const key = normalize(message);
  const entry = cache.get(key);
  return entry?.response ?? null;
}

export function setCachedResponse(message: string, response: string): void {
  const key = normalize(message);
  evictOldest();
  cache.set(key, { response, at: Date.now() });
}
