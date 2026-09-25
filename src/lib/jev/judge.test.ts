// @vitest-environment node
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { decideDraw, evaluatePosition, fallbackAcceptsDraw, JevUnavailableError } from "./judge";
import { createMockFetch } from "./mock";
import { buildDrawRequest, buildEvaluationRequest, EVALUATION_LEVELS, positionFacts } from "./prompt";
import { parseDrawRequest, parseEvaluateRequest } from "./validate";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
// White has won Black's queen: 1.e4 e5 2.Nf3 Qh4?? 3.Nxh4, Black to move.
const WHITE_UP_QUEEN = "rnb1kbnr/pppp1ppp/8/4p3/4P2N/8/PPPP1PPP/RNBQKB1R b KQkq - 0 3";
// Black is a rook up, White to move.
const BLACK_UP_ROOK = "4k3/8/8/8/8/8/r7/4K3 w - - 0 1";
const quiet = { log: () => {} };

const client = (options?: Parameters<typeof createMockFetch>[0]) =>
  new TypeSafeClient({
    apiKey: "test",
    baseURL: "https://jev-mock.invalid",
    fetch: createMockFetch(options),
    retry: { maxRetries: 0 },
    logLevel: "off",
  });

describe("position facts", () => {
  it("spells out the material, which Jev cannot count from a FEN", () => {
    const facts = positionFacts(new Chess(WHITE_UP_QUEEN), ["e4", "e5", "Nf3", "Qh4", "Nxh4"]);
    expect(facts.material_balance_for_white).toBe(9);
    expect(facts.material).toMatch(/^White is ahead by 9 points of material/);
    expect(facts.black_pieces).not.toContain("queen on d8");
    expect(facts.white_pieces).toContain("knight on h4");
    expect(positionFacts(new Chess(START), []).material).toBe("Material is level");
  });

  it("asks for an evaluation on seven levels, from Black winning to White winning", () => {
    const question = buildEvaluationRequest(new Chess(START), []).questions.evaluation;
    expect(question.type).toBe("score");
    expect(question.criteria).toEqual(EVALUATION_LEVELS);
    expect(question.criteria[0]).toBe("Black is winning");
    expect(question.criteria[6]).toBe("White is winning");
  });

  it("gives Jev the draw question from its own side, with Stockfish's view in hybrid mode", () => {
    const request = buildDrawRequest(new Chess(BLACK_UP_ROOK), [], "aggressive", "b", { type: "cp", value: -480 });
    expect(request.state).toMatchObject({ you_play: "black", material_balance_for_you: 5, stockfish_evaluation_for_you: "+4.80 pawns" });
    expect(String(request.questions.accept.instructions)).toMatch(/as Black.*offers a draw.*rarely accept draws/);
    expect(buildDrawRequest(new Chess(START), [], "balanced", "w").state).not.toHaveProperty("stockfish_evaluation_for_you");
  });
});

describe("evaluatePosition", () => {
  it("turns the mock's answer into a verdict and a share of the bar", async () => {
    const level = await evaluatePosition({ client: client(), mode: "mock", fen: START, history: [], ...quiet });
    expect(level).toMatchObject({ source: "mock", verdict: "The position is about equal", model: "jev-mock" });
    expect(level.whiteShare).toBeCloseTo(0.5, 1);

    const ahead = await evaluatePosition({ client: client(), mode: "mock", fen: WHITE_UP_QUEEN, history: [], ...quiet });
    expect(ahead.verdict).toBe("White is winning");
    expect(ahead.whiteShare).toBeGreaterThan(0.8);
  });

  it("throws a readable reason when Jev fails, since nothing local stands in for it", async () => {
    const failing = evaluatePosition({ client: client({ failWithStatus: 401 }), mode: "live", fen: START, history: [], ...quiet });
    await expect(failing).rejects.toBeInstanceOf(JevUnavailableError);
    await expect(failing).rejects.toThrow("Jev rejected the API key.");
  });
});

describe("decideDraw", () => {
  const offer = { mode: "mock" as const, history: [], personality: "balanced" as const, ...quiet };

  it("declines when level or ahead, and accepts when behind", async () => {
    const level = await decideDraw({ ...offer, client: client(), fen: START.replace(" w ", " b "), jevColor: "w" });
    expect(level).toMatchObject({ accept: false, source: "mock" });
    expect(level.probability).toBeLessThan(0.5);

    const behind = await decideDraw({ ...offer, client: client(), fen: BLACK_UP_ROOK.replace(" w ", " b "), jevColor: "w" });
    expect(behind.accept).toBe(true);
  });

  it("lets a defensive Jev take a level draw that a balanced one declines", async () => {
    const fen = START.replace(" w ", " b ");
    const defensive = await decideDraw({ ...offer, personality: "defensive", client: client(), fen, jevColor: "w" });
    expect(defensive.accept).toBe(true);
  });

  it("falls back to a material rule when Jev fails, and says why", async () => {
    const answer = await decideDraw({
      ...offer,
      mode: "live",
      client: client({ failWithStatus: 503 }),
      fen: BLACK_UP_ROOK.replace(" w ", " b "),
      jevColor: "w",
    });
    expect(answer).toMatchObject({ accept: true, source: "fallback", fallbackReason: "Jev returned an error (HTTP 503)." });
  });

  it("uses Stockfish's evaluation in the fallback when there is one", () => {
    const level = new Chess(START);
    expect(fallbackAcceptsDraw(level, "w")).toBe(false);
    expect(fallbackAcceptsDraw(level, "w", { type: "cp", value: -120 })).toBe(true);
    expect(fallbackAcceptsDraw(level, "b", { type: "cp", value: -120 })).toBe(false);
    expect(fallbackAcceptsDraw(level, "b", { type: "mate", value: 3 })).toBe(true);
  });
});

describe("request validation", () => {
  it("accepts a position still in play", () => {
    expect(parseEvaluateRequest({ fen: START, history: [] })).toEqual({ ok: true, value: { fen: START, history: [] } });
    const mated = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";
    expect(parseEvaluateRequest({ fen: mated, history: [] })).toMatchObject({ ok: false, status: 422 });
  });

  it("checks a draw offer's side, personality and score", () => {
    const base = { fen: START, history: [], personality: "balanced" };
    expect(parseDrawRequest({ ...base, jevColor: "b" })).toMatchObject({ ok: true, value: { jevColor: "b" } });
    expect(parseDrawRequest({ ...base, jevColor: "w" })).toEqual({
      ok: false,
      error: "Offer a draw on your own turn.",
      status: 422,
    });
    expect(parseDrawRequest({ ...base, jevColor: "red" })).toMatchObject({ ok: false, status: 400 });
    expect(parseDrawRequest({ ...base, jevColor: "b", personality: "reckless" })).toMatchObject({ ok: false });
    expect(parseDrawRequest({ ...base, jevColor: "b", stockfishScore: { type: "cp", value: 1.5 } })).toMatchObject({ ok: false });
    expect(parseDrawRequest({ ...base, jevColor: "b", stockfishScore: { type: "mate", value: -2 } })).toMatchObject({
      ok: true,
      value: { stockfishScore: { type: "mate", value: -2 } },
    });
  });
});
