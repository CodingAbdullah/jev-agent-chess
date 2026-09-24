// @vitest-environment node
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { decideMove, hybridCandidates } from "./decide";
import { createMockFetch } from "./mock";
import { buildMoveRequest, describeStockfishNote } from "./prompt";
import type { JevMoveRequest, StockfishCandidate } from "./types";
import { parseMoveRequest } from "./validate";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
// Black to move, Qh4# available.
const MATE_FOR_BLACK = "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2";

const shortlist: StockfishCandidate[] = [
  { uci: "e2e4", score: { type: "cp", value: 35 }, line: ["e4", "e5", "Nf3"] },
  { uci: "d2d4", score: { type: "cp", value: 30 }, line: ["d4", "d5"] },
  { uci: "g1f3", score: { type: "cp", value: 25 }, line: ["Nf3"] },
];

const request = (overrides: Partial<JevMoveRequest> = {}): JevMoveRequest => ({
  fen: START,
  history: [],
  personality: "balanced",
  difficulty: "hard",
  candidates: shortlist,
  ...overrides,
});

const mockClient = (options?: Parameters<typeof createMockFetch>[0]) =>
  new TypeSafeClient({
    apiKey: "test",
    baseURL: "https://jev-mock.invalid",
    fetch: createMockFetch(options),
    retry: { maxRetries: 0 },
    logLevel: "off",
  });

describe("describeStockfishNote", () => {
  it("speaks from the side to move", () => {
    const note = { rank: 2, score: { type: "cp", value: -120 } as const, line: ["Nf6", "e5"] };
    expect(describeStockfishNote(note, "b")).toBe(
      "Stockfish's choice #2, Stockfish evaluation for you: +1.20 pawns, expected reply e5",
    );
    expect(describeStockfishNote({ ...note, score: { type: "mate", value: -1 } }, "b")).toContain(
      "Stockfish sees mate in 1 for you",
    );
    expect(describeStockfishNote({ ...note, score: { type: "mate", value: 3 } }, "b")).toContain(
      "Stockfish sees you getting mated in 3",
    );
  });
});

describe("hybrid requests", () => {
  it("offers only Stockfish's legal candidates, in its order, with its notes", () => {
    const chess = new Chess(START);
    const { moves, notes } = hybridCandidates(chess, [
      ...shortlist,
      { uci: "e2e5", score: { type: "cp", value: 0 }, line: [] },
    ]);
    expect(moves.map((move) => move.san)).toEqual(["e4", "d4", "Nf3"]);
    const built = buildMoveRequest(chess, [], "tactical", { candidates: moves, stockfish: notes });
    const criteria = built.questions.move.criteria;
    expect(Object.keys(criteria)).toEqual(["e4", "d4", "Nf3"]);
    expect(criteria.e4).toBe(
      "Pawn from e2 to e4. Stockfish's choice #1, Stockfish evaluation for you: +0.35 pawns, expected reply e5",
    );
    expect(String(built.questions.move.instructions)).toMatch(/Stockfish, a strong chess engine, has shortlisted/);
    expect(String(built.questions.move.instructions)).toMatch(/tactically/);
  });

  it("answers with one of the candidates", async () => {
    const decision = await decideMove({ client: mockClient(), mode: "mock", request: request(), log: () => {} });
    expect(["e4", "d4", "Nf3"]).toContain(decision.san);
    expect(decision.alternatives.map((entry) => entry.san).sort()).toEqual(["Nf3", "d4", "e4"]);
  });

  it("takes the mate from the shortlist", async () => {
    const decision = await decideMove({
      client: mockClient(),
      mode: "mock",
      request: request({
        fen: MATE_FOR_BLACK,
        candidates: [
          { uci: "b8c6", score: { type: "cp", value: 50 }, line: ["Nc6"] },
          { uci: "d8h4", score: { type: "mate", value: -1 }, line: ["Qh4#"] },
        ],
      }),
      log: () => {},
    });
    expect(decision.san).toBe("Qh4#");
  });

  it("falls back to Stockfish's top choice when Jev fails", async () => {
    const decision = await decideMove({
      client: mockClient({ failWithStatus: 500 }),
      mode: "live",
      request: request({ candidates: [shortlist[1]!, shortlist[0]!] }),
      log: () => {},
    });
    expect(decision.source).toBe("fallback");
    expect(decision.san).toBe("d4");
    expect(decision.fallbackReason).toBe("Jev returned an error (HTTP 500).");
  });
});

describe("parseMoveRequest with candidates", () => {
  const base = { fen: START, history: [], personality: "balanced", difficulty: "medium" };

  it("accepts a valid shortlist", () => {
    const parsed = parseMoveRequest({ ...base, candidates: shortlist });
    expect(parsed.ok && parsed.value.candidates).toEqual(shortlist);
  });

  it("drops unexpected fields from candidates", () => {
    const parsed = parseMoveRequest({
      ...base,
      candidates: [{ ...shortlist[0], extra: "<script>", score: { type: "cp", value: 35, note: "x" } }],
    });
    expect(parsed.ok && parsed.value.candidates).toEqual([shortlist[0]]);
  });

  it.each([
    [[], "candidates must be an array of 1 to 8 moves."],
    [Array(9).fill(shortlist[0]), "candidates must be an array of 1 to 8 moves."],
    [[{ ...shortlist[0], uci: "e4" }], "Each candidate needs a move in UCI notation."],
    [[{ ...shortlist[0], score: { type: "cp", value: 1.5 } }], "Each candidate needs a score in centipawns or moves to mate."],
    [[{ ...shortlist[0], line: ["<b>"] }], "Each candidate's line must be at most 10 moves in SAN."],
    [[{ ...shortlist[0], uci: "e2e5" }], "None of the candidates is a legal move in this position."],
  ])("rejects %j", (candidates, error) => {
    expect(parseMoveRequest({ ...base, candidates })).toEqual({ ok: false, error, status: 400 });
  });
});
