import { describe, expect, it, vi } from "vitest";
import { askForDraw, jevAnswer, stockfishAnswer } from "./draw-offer";
import type { AiConfig } from "./game-config";
import type { StockfishEngine } from "./stockfish/engine";

// Move 12, White to move.
const MIDDLEGAME = "r1bq1rk1/pp2bppp/2n1pn2/3p4/3P4/2NBPN2/PP3PPP/R2QK2R w KQ - 2 12";
const OPENING = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";

/** A fake engine whose search reports one line with the given score, from the side to move. */
function engineScoring(value: number) {
  const search = vi.fn(async () => ({
    bestMove: "e1g1",
    lines: [{ depth: 12, multipv: 1, score: { type: "cp" as const, value }, pv: ["e1g1"] }],
  }));
  return { engine: { search } as unknown as StockfishEngine, search };
}

const signal = new AbortController().signal;

describe("stockfishAnswer", () => {
  it("declines when it is better and accepts when level or worse", () => {
    expect(stockfishAnswer({ type: "cp", value: 135 }, "w")).toEqual({
      accept: false,
      message: "Stockfish declines: it thinks it is better (+1.35).",
    });
    expect(stockfishAnswer({ type: "cp", value: 10 }, "w").message).toBe(
      "Stockfish accepts: it judges the position level (+0.10).",
    );
    // Scores are from White's side, so +1.35 is bad news for a Stockfish playing Black.
    expect(stockfishAnswer({ type: "cp", value: 135 }, "b")).toMatchObject({ accept: true });
    expect(stockfishAnswer({ type: "mate", value: -3 }, "b")).toMatchObject({ accept: false });
  });
});

describe("jevAnswer", () => {
  it("says how sure Jev was, or why a fallback decided", () => {
    expect(jevAnswer({ accept: false, source: "jev", probability: 0.29, latencyMs: 1 }, "Jev").message).toBe(
      "Jev declines the draw (29% for accepting).",
    );
    expect(
      jevAnswer({ accept: true, source: "fallback", fallbackReason: "Jev could not be reached.", latencyMs: 1 }, "Jev")
        .message,
    ).toBe("Jev accepts. Jev could not be reached. A simple rule decided instead.");
  });
});

describe("askForDraw", () => {
  const jevConfig: AiConfig = { mode: "jev", humanColor: "w", personality: "balanced", difficulty: "medium" };

  it("declines before move 10 without asking anyone", async () => {
    const askJev = vi.fn();
    const { engine, search } = engineScoring(0);
    const answer = await askForDraw({ config: jevConfig, fen: OPENING, history: [], getEngine: () => engine, signal, askJev });
    expect(answer.accept).toBe(false);
    expect(answer.message).toMatch(/too early/);
    expect(askJev).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });

  it("lets Stockfish judge by its own evaluation", async () => {
    // Stockfish plays Black; the search scores the position for White, the side to move.
    const { engine } = engineScoring(-80);
    const config: AiConfig = { mode: "stockfish", humanColor: "w", difficulty: "hard" };
    const answer = await askForDraw({ config, fen: MIDDLEGAME, history: [], getEngine: () => engine, signal });
    expect(answer).toMatchObject({ accept: false, message: "Stockfish declines: it thinks it is better (+0.80)." });
  });

  it("asks Jev alone in Jev games", async () => {
    const askJev = vi.fn(async () => ({ accept: true, source: "mock" as const, probability: 0.7, latencyMs: 5 }));
    const { engine, search } = engineScoring(0);
    const answer = await askForDraw({ config: jevConfig, fen: MIDDLEGAME, history: ["e4"], getEngine: () => engine, signal, askJev });
    expect(answer).toMatchObject({ accept: true, source: "mock" });
    expect(askJev).toHaveBeenCalledWith(
      { fen: MIDDLEGAME, history: ["e4"], personality: "balanced", jevColor: "b" },
      signal,
    );
    expect(search).not.toHaveBeenCalled();
  });

  it("gives Jev Stockfish's evaluation, from White's side, in hybrid games", async () => {
    const askJev = vi.fn(async () => ({ accept: false, source: "jev" as const, probability: 0.2, latencyMs: 5 }));
    const { engine } = engineScoring(45);
    const config: AiConfig = { mode: "hybrid", humanColor: "w", personality: "tactical", difficulty: "easy" };
    const answer = await askForDraw({ config, fen: MIDDLEGAME, history: [], getEngine: () => engine, signal, askJev });
    expect(answer.message).toBe("Jev + Stockfish declines the draw (20% for accepting).");
    expect(askJev).toHaveBeenCalledWith(
      expect.objectContaining({ jevColor: "b", personality: "tactical", stockfishScore: { type: "cp", value: 45 } }),
      signal,
    );
  });
});
