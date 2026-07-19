// Fixed-window rate limiter with bounded memory.
//
// Extracted from app/api/contact/route.ts so the window, pruning, and size-cap
// logic is a pure, clock-injectable unit: tests pass `now` explicitly instead
// of sleeping. State lives per instance (per warm serverless instance in the
// route), so this deters spam rather than providing a hard global guarantee.

type RateLimiterOptions = Readonly<{
  /** Length of the fixed window in milliseconds. */
  windowMs: number;
  /** Maximum allowed calls per key within one window. */
  max: number;
  /**
   * Hard cap on tracked keys. Expired entries are pruned on every call; if a
   * flood of distinct keys still fills the map, the oldest window is evicted
   * so hostile key churn can't grow memory without bound.
   */
  maxEntries?: number;
}>;

type RateLimiter = Readonly<{
  /** True if this call is allowed for `key`; false once the window is spent. */
  allow: (key: string, now?: number) => boolean;
}>;

const DEFAULT_MAX_ENTRIES = 1_000;

export function createRateLimiter({
  windowMs,
  max,
  maxEntries = DEFAULT_MAX_ENTRIES,
}: RateLimiterOptions): RateLimiter {
  const hits = new Map<string, { count: number; ts: number }>();

  return {
    allow(key, now = Date.now()) {
      // Prune every expired window so idle keys never accumulate.
      for (const [trackedKey, entry] of hits) {
        if (now - entry.ts > windowMs) hits.delete(trackedKey);
      }

      const entry = hits.get(key);
      if (entry) {
        entry.count += 1;
        return entry.count <= max;
      }

      if (hits.size >= maxEntries) {
        // Map iteration preserves insertion order, so the first key holds the
        // oldest live window — the fairest one to sacrifice at the cap.
        const oldest = hits.keys().next().value;
        if (oldest !== undefined) hits.delete(oldest);
      }
      hits.set(key, { count: 1, ts: now });
      return true;
    },
  };
}
