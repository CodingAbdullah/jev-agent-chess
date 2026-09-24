/**
 * A token-bucket rate limiter kept in memory. Each key gets `limit` requests
 * that refill evenly over `windowMs`, so short bursts are allowed but the
 * average rate is capped.
 *
 * State lives in this server process only. That protects a single server,
 * but a deployment with several instances needs a shared store instead, such
 * as Redis or the hosting platform's own rate limiting.
 */

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterMs: number };

type Bucket = { tokens: number; updatedAt: number };

export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private readonly refillPerMs: number;

  constructor(
    private readonly limit: number,
    windowMs: number,
    /** Oldest keys are forgotten beyond this, so memory stays bounded. */
    private readonly maxKeys = 10_000,
  ) {
    if (!(limit > 0) || !(windowMs > 0)) throw new Error("Rate limit and window must be positive.");
    this.refillPerMs = limit / windowMs;
  }

  check(key: string, now = Date.now()): RateLimitResult {
    const bucket = this.buckets.get(key) ?? { tokens: this.limit, updatedAt: now };
    const tokens = Math.min(this.limit, bucket.tokens + (now - bucket.updatedAt) * this.refillPerMs);

    // Re-insert so the Map keeps keys in least-recently-used order.
    this.buckets.delete(key);
    if (tokens < 1) {
      this.buckets.set(key, { tokens, updatedAt: now });
      return { allowed: false, retryAfterMs: Math.ceil((1 - tokens) / this.refillPerMs) };
    }
    this.buckets.set(key, { tokens: tokens - 1, updatedAt: now });
    if (this.buckets.size > this.maxKeys) {
      const oldest = this.buckets.keys().next().value;
      if (oldest !== undefined) this.buckets.delete(oldest);
    }
    return { allowed: true, remaining: Math.floor(tokens - 1) };
  }
}

/** The client's address as reported by the hosting proxy, or "unknown". */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

const MINUTE = 60_000;

function readLimit(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

let cached: { signature: string; perClient: RateLimiter; global: RateLimiter } | null = null;

/**
 * Limits for the Jev route: per client, and across all clients so the API
 * key's quota is protected even from many addresses at once. Both can be
 * changed with environment variables.
 */
export function jevRateLimiters(env: NodeJS.ProcessEnv = process.env) {
  const perClient = readLimit(env.JEV_RATE_LIMIT_PER_MINUTE, 30);
  const global = readLimit(env.JEV_GLOBAL_RATE_LIMIT_PER_MINUTE, 300);
  const signature = `${perClient}:${global}`;
  if (cached?.signature !== signature) {
    cached = { signature, perClient: new RateLimiter(perClient, MINUTE), global: new RateLimiter(global, MINUTE) };
  }
  return cached;
}
