// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as draw } from "./draw/route";
import { POST as evaluate } from "./evaluate/route";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const post = (handler: (request: Request) => Promise<Response>, body: unknown, ip = "203.0.113.20") =>
  handler(
    new Request("http://localhost/api/jev", {
      method: "POST",
      headers: { "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }),
  );

describe("POST /api/jev/evaluate", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns Jev's verdict and a share of the bar", async () => {
    vi.stubEnv("JEV_MOCK", "1");
    const response = await post(evaluate, { fen: START, history: [] });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toMatchObject({ source: "mock", verdict: "The position is about equal" });
    expect(body.whiteShare).toBeGreaterThan(0.4);
    expect(body.whiteShare).toBeLessThan(0.6);
  });

  it("rejects an invalid position", async () => {
    const response = await post(evaluate, { fen: "nonsense", history: [] });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "fen must be a valid FEN string." });
  });

  it("shares the rate limit with the move route", async () => {
    vi.stubEnv("JEV_MOCK", "1");
    vi.stubEnv("JEV_RATE_LIMIT_PER_MINUTE", "1");
    expect((await post(evaluate, { fen: START, history: [] }, "198.51.100.30")).status).toBe(200);
    const limited = await post(evaluate, { fen: START, history: [] }, "198.51.100.30");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
  });
});

describe("POST /api/jev/draw", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("answers a draw offer on the player's turn", async () => {
    vi.stubEnv("JEV_MOCK", "1");
    const response = await post(draw, { fen: START, history: [], personality: "balanced", jevColor: "b" });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ accept: false, source: "mock" });
    expect(body.probability).toBeGreaterThan(0);
  });

  it("refuses an offer made on Jev's turn", async () => {
    const response = await post(draw, { fen: START, history: [], personality: "balanced", jevColor: "w" });
    expect(response.status).toBe(422);
  });
});
