// store.js — JSON fetching with a localStorage "last good" fallback.
//
// Every successful response is cached. If a later fetch fails (no signal,
// airplane mode, API hiccup) we transparently fall back to the most recent
// cached copy and tell the caller how stale it is, so the dashboard keeps
// showing something useful instead of an error.

const PREFIX = "aloha:cache:";

function readCache(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw); // { savedAt, data }
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(
      PREFIX + key,
      JSON.stringify({ savedAt: Date.now(), data })
    );
  } catch {
    /* quota or private mode — caching is best-effort */
  }
}

/**
 * Fetch JSON with caching.
 * @returns {Promise<{data:any, fromCache:boolean, savedAt:number|null}>}
 * Throws only if the request fails AND there is no cached copy.
 */
export async function fetchJSON(url, cacheKey, { timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    writeCache(cacheKey, data);
    return { data, fromCache: false, savedAt: Date.now() };
  } catch (err) {
    const cached = readCache(cacheKey);
    if (cached) {
      return { data: cached.data, fromCache: true, savedAt: cached.savedAt };
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
