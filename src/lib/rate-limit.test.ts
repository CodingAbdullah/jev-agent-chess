import { describe, expect, it, vi } from "vitest";
import { clientKey, jevRateLimiters, RateLimiter, RedisRateLimiter, upstashConfig } from "./rate-limit";

describe("RateLimiter", () => {
  it("allows a burst up to the limit, then asks the client to wait", () => {
    const limiter = new RateLimiter(3, 60_000);
    expect(limiter.check("a", 0)).toEqual({ allowed: true, remaining: 2 });
    expect(limiter.check("a", 0)).toEqual({ allowed: true, remaining: 1 });
    expect(limiter.check("a", 0)).toEqual({ allowed: true, remaining: 0 });
    expect(limiter.check("a", 0)).toEqual({ allowed: false, retryAfterMs: 20_000 });
  });

  it("refills over time", () => {
    const limiter = new RateLimiter(2, 60_000);
    limiter.check("a", 0);
    limiter.check("a", 0);
    expect(limiter.check("a", 10_000).allowed).toBe(false);
    expect(limiter.check("a", 30_000).allowed).toBe(true);
  });

  it("keeps separate buckets per key", () => {
    const limiter = new RateLimiter(1, 60_000);
    expect(limiter.check("a", 0).allowed).toBe(true);
    expect(limiter.check("b", 0).allowed).toBe(true);
    expect(limiter.check("a", 0).allowed).toBe(false);
  });

  it("forgets the least recently used keys beyond its capacity", () => {
    const limiter = new RateLimiter(1, 60_000, 2);
    limiter.check("a", 0);
    limiter.check("b", 0);
    limiter.check("c", 0);
    // "a" was evicted, so it starts with a full bucket again.
    expect(limiter.check("a", 0).allowed).toBe(true);
  });

  it("rejects nonsense settings", () => {
    expect(() => new RateLimiter(0, 1000)).toThrow();
  });
});

describe("clientKey", () => {
  it("uses the first forwarded address, then the real IP header", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
    expect(clientKey(new Headers({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
    expect(clientKey(new Headers())).toBe("unknown");
  });
});

const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;

describe("jevRateLimiters", () => {
  it("reads limits from the environment and ignores bad values", async () => {
    const limiters = jevRateLimiters(env({ JEV_RATE_LIMIT_PER_MINUTE: "2", JEV_GLOBAL_RATE_LIMIT_PER_MINUTE: "oops" }));
    expect(limiters.store).toBe("memory");
    expect((await limiters.perClient.check("x", 0)).allowed).toBe(true);
    expect((await limiters.perClient.check("x", 0)).allowed).toBe(true);
    expect((await limiters.perClient.check("x", 0)).allowed).toBe(false);
    for (let i = 0; i < 300; i++) expect((await limiters.global.check("all", 0)).allowed).toBe(true);
    expect((await limiters.global.check("all", 0)).allowed).toBe(false);
  });

  it("uses Redis when Upstash or Vercel's integration is configured", () => {
    expect(jevRateLimiters(env({ UPSTASH_REDIS_REST_URL: "https://a.upstash.io", UPSTASH_REDIS_REST_TOKEN: "t" })).store).toBe("redis");
    expect(jevRateLimiters(env({ KV_REST_API_URL: "https://b.upstash.io", KV_REST_API_TOKEN: "t" })).store).toBe("redis");
    expect(jevRateLimiters(env({ UPSTASH_REDIS_REST_URL: "https://a.upstash.io" })).store).toBe("memory");
  });
});

describe("upstashConfig", () => {
  it("prefers Upstash's names and trims a trailing slash", () => {
    expect(
      upstashConfig(env({ UPSTASH_REDIS_REST_URL: "https://a.upstash.io/", UPSTASH_REDIS_REST_TOKEN: "t1", KV_REST_API_URL: "https://b", KV_REST_API_TOKEN: "t2" })),
    ).toEqual({ url: "https://a.upstash.io", token: "t1" });
    expect(upstashConfig(env({}))).toBeNull();
  });
});

describe("RedisRateLimiter", () => {
  const config = { url: "https://redis.example", token: "secret-token" };
  const reply = (body: unknown, status = 200) => async () =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  it("sends the token bucket script with the key and limits", async () => {
    const fetchImpl = vi.fn(reply({ result: [1, 29] }));
    const limiter = new RedisRateLimiter(config, "client", 30, 60_000, undefined, fetchImpl);
    expect(await limiter.check("203.0.113.1")).toEqual({ allowed: true, remaining: 29 });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://redis.example");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer secret-token");
    const command = JSON.parse(String(init.body)) as string[];
    expect(command[0]).toBe("EVAL");
    expect(command.slice(2)).toEqual(["1", "jev-chess:rate-limit:client:203.0.113.1", "30", "60000"]);
  });

  it("reports how long to wait when the bucket is empty", async () => {
    const limiter = new RedisRateLimiter(config, "client", 30, 60_000, undefined, reply({ result: [0, 1500] }));
    expect(await limiter.check("a")).toEqual({ allowed: false, retryAfterMs: 1500 });
  });

  it("falls back to its own memory when Redis fails, and warns once a minute", async () => {
    const log = vi.fn();
    const limiter = new RedisRateLimiter(
      config, "client", 1, 60_000, new RateLimiter(1, 60_000), reply({ error: "WRONGPASS" }, 401), log,
    );
    expect((await limiter.check("a", 0)).allowed).toBe(true);
    expect((await limiter.check("a", 1)).allowed).toBe(false);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]![0]).toContain("HTTP 401: WRONGPASS");
    expect(log.mock.calls[0]![0]).not.toContain("secret-token");
  });

  it("falls back when the network fails or the reply is malformed", async () => {
    const offline = new RedisRateLimiter(config, "c", 5, 60_000, undefined, async () => { throw new TypeError("fetch failed"); }, () => {});
    expect(await offline.check("a")).toEqual({ allowed: true, remaining: 4 });
    const odd = new RedisRateLimiter(config, "c", 5, 60_000, undefined, reply({ result: "OK" }), () => {});
    expect(await odd.check("a")).toEqual({ allowed: true, remaining: 4 });
  });
});
