/**
 * Token-bucket rate limiting. Each key gets `limit` requests that refill
 * evenly over `windowMs`, so short bursts are allowed but the average rate is
 * capped.
 *
 * `RateLimiter` keeps its state in this server process, which protects a
 * single server. With Upstash Redis configured, `RedisRateLimiter` keeps the
 * buckets in Redis instead, so every instance of a deployment shares them.
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

/** A limiter the route can use, whether its state is in memory or in Redis. */
export interface Limiter {
  check(key: string, now?: number): Promise<RateLimitResult>;
}

class MemoryLimiter implements Limiter {
  constructor(private readonly limiter: RateLimiter) {}
  async check(key: string, now?: number) {
    return this.limiter.check(key, now);
  }
}

export type UpstashConfig = { url: string; token: string };

/**
 * Upstash Redis's REST settings, from the names Upstash uses or the ones
 * Vercel's Upstash integration sets. Null when neither pair is complete.
 */
export function upstashConfig(env: NodeJS.ProcessEnv): UpstashConfig | null {
  for (const [urlName, tokenName] of [
    ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    ["KV_REST_API_URL", "KV_REST_API_TOKEN"],
  ] as const) {
    const url = env[urlName]?.trim();
    const token = env[tokenName]?.trim();
    if (url && token) return { url: url.replace(/\/+$/, ""), token };
  }
  return null;
}

/**
 * The same token bucket as `RateLimiter`, run atomically inside Redis. It uses
 * Redis's clock, so instances with drifting clocks still agree. A bucket that
 * sits idle for a whole window is full again, so it expires after one.
 * Returns {1, remaining} or {0, retryAfterMs}: Lua numbers become integers.
 */
const TOKEN_BUCKET_SCRIPT = `
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local rate = limit / window
local bucket = redis.call('HMGET', KEYS[1], 'tokens', 'updated')
local tokens = tonumber(bucket[1]) or limit
local updated = tonumber(bucket[2]) or now
tokens = math.min(limit, tokens + math.max(0, now - updated) * rate)
local allowed = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
end
redis.call('HSET', KEYS[1], 'tokens', tostring(tokens), 'updated', tostring(now))
redis.call('PEXPIRE', KEYS[1], window)
if allowed == 1 then return {1, math.floor(tokens)} end
return {0, math.ceil((1 - tokens) / rate)}
`;

/** How long a Redis check may take before the local limiter decides instead. */
const REDIS_TIMEOUT_MS = 1_000;

type Fetch = typeof fetch;

/**
 * A rate limiter shared by every server instance through Upstash Redis's REST
 * API, which works from serverless functions without a database connection.
 * If Redis fails or is slow, the in-memory limiter answers instead, so an
 * outage weakens the limit to per-instance rather than blocking every game.
 */
export class RedisRateLimiter implements Limiter {
  private lastWarning = -Infinity;

  constructor(
    private readonly config: UpstashConfig,
    private readonly name: string,
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly fallback = new RateLimiter(limit, windowMs),
    private readonly fetchImpl: Fetch = fetch,
    private readonly log: (message: string) => void = (message) => console.warn(message),
  ) {}

  async check(key: string, now = Date.now()): Promise<RateLimitResult> {
    try {
      const response = await this.fetchImpl(this.config.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.config.token}`, "Content-Type": "application/json" },
        body: JSON.stringify([
          "EVAL",
          TOKEN_BUCKET_SCRIPT,
          "1",
          `jev-chess:rate-limit:${this.name}:${key}`,
          String(this.limit),
          String(this.windowMs),
        ]),
        signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
        cache: "no-store",
      });
      const body = (await response.json().catch(() => ({}))) as { result?: unknown; error?: unknown };
      if (!response.ok || body.error !== undefined) {
        throw new Error(`HTTP ${response.status}: ${String(body.error ?? "request failed")}`);
      }
      const [allowed, value] = Array.isArray(body.result) ? body.result : [];
      if (typeof allowed !== "number" || typeof value !== "number") throw new Error("unexpected reply");
      return allowed === 1 ? { allowed: true, remaining: value } : { allowed: false, retryAfterMs: value };
    } catch (error) {
      // One warning a minute is enough to notice an outage without flooding the logs.
      if (now - this.lastWarning >= 60_000) {
        this.lastWarning = now;
        this.log(`Rate limit store unavailable, limiting per instance: ${error instanceof Error ? error.message : error}`);
      }
      return this.fallback.check(key, now);
    }
  }
}

const MINUTE = 60_000;

function readLimit(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export type JevRateLimiters = { store: "memory" | "redis"; perClient: Limiter; global: Limiter };

let cached: { signature: string; limiters: JevRateLimiters } | null = null;

/**
 * Limits for the Jev route: per client, and across all clients so the API
 * key's quota is protected even from many addresses at once. Both can be
 * changed with environment variables. With Upstash Redis configured, the
 * limits hold across every server instance.
 */
export function jevRateLimiters(env: NodeJS.ProcessEnv = process.env): JevRateLimiters {
  const perClient = readLimit(env.JEV_RATE_LIMIT_PER_MINUTE, 30);
  const global = readLimit(env.JEV_GLOBAL_RATE_LIMIT_PER_MINUTE, 300);
  const redis = upstashConfig(env);
  // The signature never contains the token itself.
  const signature = `${perClient}:${global}:${redis?.url ?? ""}`;
  if (cached?.signature !== signature) {
    const limiters: JevRateLimiters = redis
      ? {
          store: "redis",
          perClient: new RedisRateLimiter(redis, "client", perClient, MINUTE),
          global: new RedisRateLimiter(redis, "global", global, MINUTE),
        }
      : {
          store: "memory",
          perClient: new MemoryLimiter(new RateLimiter(perClient, MINUTE)),
          global: new MemoryLimiter(new RateLimiter(global, MINUTE)),
        };
    cached = { signature, limiters };
  }
  return cached.limiters;
}
