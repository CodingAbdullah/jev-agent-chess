import { describe, expect, it } from "vitest";
import { clientKey, jevRateLimiters, RateLimiter } from "./rate-limit";

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

describe("jevRateLimiters", () => {
  it("reads limits from the environment and ignores bad values", () => {
    const limiters = jevRateLimiters({ JEV_RATE_LIMIT_PER_MINUTE: "2", JEV_GLOBAL_RATE_LIMIT_PER_MINUTE: "oops" } as unknown as NodeJS.ProcessEnv);
    expect(limiters.perClient.check("x", 0).allowed).toBe(true);
    expect(limiters.perClient.check("x", 0).allowed).toBe(true);
    expect(limiters.perClient.check("x", 0).allowed).toBe(false);
    for (let i = 0; i < 300; i++) expect(limiters.global.check("all", 0).allowed).toBe(true);
    expect(limiters.global.check("all", 0).allowed).toBe(false);
  });
});
