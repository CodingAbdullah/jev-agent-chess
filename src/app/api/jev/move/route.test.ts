// @vitest-environment node
import { Chess } from "chess.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/jev/move", {
      method: "POST",
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
});
