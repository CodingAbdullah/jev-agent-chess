// @vitest-environment node
import { Chess } from "chess.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const post = (body: unknown, ip = "203.0.113.1") =>
  POST(
    new Request("http://localhost/api/jev/move", {
      method: "POST",
      headers: { "x-forwarded-for": ip },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("POST /api/jev/move", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the mock when no API key is set and returns a legal move", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    const response = await post({ fen: START, history: [], personality: "tactical", difficulty: "medium" });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.source).toBe("mock");
    expect(new Chess(START).moves()).toContain(body.san);
  });

  it("never includes the API key in its response", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "sk-secret-value");
    vi.stubEnv("JEV_MOCK", "1");
    const response = await post({ fen: START, history: [], personality: "balanced", difficulty: "hard" });
    expect(await response.text()).not.toContain("sk-secret-value");
  });

  it("rejects bodies that are not JSON", async () => {
    const response = await post("not json");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Request body must be JSON." });
  });

  it("rejects invalid requests with a reason", async () => {
    const response = await post({ fen: START, history: [], personality: "balanced", difficulty: "godlike" });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "difficulty is not recognised." });
  });

  it("rejects oversized bodies", async () => {
    const response = await post({ fen: START, history: Array(5000).fill("e4"), personality: "balanced", difficulty: "hard" });
    expect(response.status).toBe(413);
  });

  it("chooses only among Stockfish's candidates in hybrid mode", async () => {
    vi.stubEnv("JEV_MOCK", "1");
    const response = await post({
      fen: START,
      history: [],
      personality: "positional",
      difficulty: "hard",
      candidates: [
        { uci: "g1f3", score: { type: "cp", value: 30 }, line: ["Nf3", "d5"] },
        { uci: "c2c4", score: { type: "cp", value: 28 }, line: ["c4"] },
      ],
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(["Nf3", "c4"]).toContain(body.san);
    expect(body.alternatives.map((entry: { san: string }) => entry.san).sort()).toEqual(["Nf3", "c4"]);
  });

  it("rejects a shortlist with no legal moves", async () => {
    const response = await post({
      fen: START,
      history: [],
      personality: "balanced",
      difficulty: "hard",
      candidates: [{ uci: "e2e5", score: { type: "cp", value: 0 }, line: [] }],
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "None of the candidates is a legal move in this position." });
  });

  it("limits how often one client can ask for moves", async () => {
    vi.stubEnv("JEV_RATE_LIMIT_PER_MINUTE", "2");
    vi.stubEnv("JEV_MOCK", "1");
    const body = { fen: START, history: [], personality: "balanced", difficulty: "hard" };
    expect((await post(body, "198.51.100.9")).status).toBe(200);
    expect((await post(body, "198.51.100.9")).status).toBe(200);
    const limited = await post(body, "198.51.100.9");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("30");
    expect(await limited.json()).toEqual({
      error: "You are asking for moves too quickly. Try again in 30 seconds.",
    });
    // Another client is unaffected.
    expect((await post(body, "198.51.100.10")).status).toBe(200);
  });
});
