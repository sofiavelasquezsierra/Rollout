/**
 * In-memory token bucket per (bucket, IP). Good enough for a portfolio demo on
 * a single serverless instance; it resets on cold start and is not shared
 * across instances (see README → Known limitations).
 */
interface Bucket {
  tokens: number;
  updated: number;
  day: string;
  dayCount: number;
}

export interface LimitSpec {
  /** Burst size. */
  capacity: number;
  /** Tokens refilled per second. */
  refillPerSec: number;
  /** Absolute cap per IP per UTC day. */
  dailyMax: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}

export function takeToken(
  name: string,
  ip: string,
  spec: LimitSpec,
  now = Date.now(),
): { ok: true } | { ok: false; retryAfterSec: number; reason: string } {
  sweep(now);
  const key = `${name}:${ip}`;
  const day = new Date(now).toISOString().slice(0, 10);
  const b = buckets.get(key) ?? { tokens: spec.capacity, updated: now, day, dayCount: 0 };
  if (b.day !== day) {
    b.day = day;
    b.dayCount = 0;
  }
  b.tokens = Math.min(spec.capacity, b.tokens + ((now - b.updated) / 1000) * spec.refillPerSec);
  b.updated = now;
  buckets.set(key, b);

  if (b.dayCount >= spec.dailyMax) {
    return { ok: false, retryAfterSec: 3600, reason: "daily limit reached" };
  }
  if (b.tokens < 1) {
    return { ok: false, retryAfterSec: Math.ceil((1 - b.tokens) / spec.refillPerSec), reason: "rate limited" };
  }
  b.tokens -= 1;
  b.dayCount += 1;
  return { ok: true };
}

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of buckets) if (now - b.updated > 15 * 60_000) buckets.delete(k);
}

export const AGENT_LIMIT: LimitSpec = { capacity: 20, refillPerSec: 0.5, dailyMax: 600 };
export const EVAL_LIMIT: LimitSpec = { capacity: 6, refillPerSec: 0.1, dailyMax: 120 };

/** Test hook. */
export function resetRateLimits() {
  buckets.clear();
}
