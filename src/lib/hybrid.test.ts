import { describe, expect, it, vi } from "vitest";
import { hybridMove } from "./hybrid";
import type { JevMoveResponse } from "./jev/types";
import type { SearchResult, StockfishEngine } from "./stockfish/engine";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

const fakeEngine = (result: SearchResult) =>
  ({ search: vi.fn(async () => result) }) as unknown as StockfishEngine & { search: ReturnType<typeof vi.fn> };

const jevAnswer = (san: string, move: JevMoveResponse["move"]): JevMoveResponse => ({
  move,
  san,
  source: "mock",
  confidence: 0.6,
  topChoice: { san, probability: 0.6 },
  alternatives: [
    { san, probability: 0.6 },
    { san: "e5", probability: 0.3 },
  ],
  latencyMs: 3,
});

describe("hybridMove", () => {
  it("asks Stockfish for a shortlist, then lets Jev choose", async () => {
    const engine = fakeEngine({
      bestMove: "e7e5",
      lines: [
        { depth: 10, multipv: 1, score: { type: "cp", value: -30 }, pv: ["e7e5", "g1f3", "b8c6"] },
        { depth: 10, multipv: 2, score: { type: "cp", value: -35 }, pv: ["c7c5", "g1f3"] },
        { depth: 10, multipv: 3, score: { type: "cp", value: -45 }, pv: ["e7e6"] },
      ],
    });
    const askJev = vi.fn(async () => jevAnswer("c5", { from: "c7", to: "c5" }));
    const controller = new AbortController();

    const result = await hybridMove({
      engine,
      fen: AFTER_E4,
      history: ["e4"],
      personality: "aggressive",
      difficulty: "medium",
      signal: controller.signal,
      askJev,
    });

    expect(engine.search).toHaveBeenCalledWith(AFTER_E4, expect.objectContaining({ multipv: 5, skill: 20, depth: 10 }));
    expect(askJev).toHaveBeenCalledWith(
      {
        fen: AFTER_E4,
        history: ["e4"],
        personality: "aggressive",
        difficulty: "medium",
        candidates: [
          // Scores are turned to White's side: Black's -30 is White's +30.
          { uci: "e7e5", score: { type: "cp", value: 30 }, line: ["e5", "Nf3", "Nc6"] },
          { uci: "c7c5", score: { type: "cp", value: 35 }, line: ["c5", "Nf3"] },
          { uci: "e7e6", score: { type: "cp", value: 45 }, line: ["e6"] },
        ],
      },
      controller.signal,
    );
    expect(result.san).toBe("c5");
    expect(result.depth).toBe(10);
    expect(result.shortlist).toEqual([
      { san: "e5", rank: 1, score: { type: "cp", value: 30 }, probability: 0.3 },
      { san: "c5", rank: 2, score: { type: "cp", value: 35 }, probability: 0.6 },
      { san: "e6", rank: 3, score: { type: "cp", value: 45 }, probability: undefined },
    ]);
  });

  it("skips Jev when there is only one candidate", async () => {
    const engine = fakeEngine({
      bestMove: "e2e4",
      lines: [{ depth: 6, multipv: 1, score: { type: "cp", value: 20 }, pv: ["e2e4"] }],
    });
    const askJev = vi.fn();
    const result = await hybridMove({
      engine,
      fen: START,
      history: [],
      personality: "balanced",
      difficulty: "easy",
      signal: new AbortController().signal,
      askJev,
    });
    expect(askJev).not.toHaveBeenCalled();
    expect(result).toMatchObject({ san: "e4", jev: null, move: { from: "e2", to: "e4" } });
  });

  it("fails clearly when Stockfish finds nothing", async () => {
    const engine = fakeEngine({ bestMove: null, lines: [] });
    await expect(
      hybridMove({
        engine,
        fen: START,
        history: [],
        personality: "balanced",
        difficulty: "easy",
        signal: new AbortController().signal,
        askJev: vi.fn(),
      }),
    ).rejects.toThrow("Stockfish found no moves to shortlist.");
  });
});
