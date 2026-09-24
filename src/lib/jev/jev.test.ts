// @vitest-environment node
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { Chess } from "chess.js";
import { describe, expect, it, vi } from "vitest";
import { replay, type MoveInput } from "@/lib/chess/game";
import { decideMove, describeFailure } from "./decide";
import { createMockFetch, MOCK_MODEL } from "./mock";
import { buildMoveRequest, candidateMoves, describeMove, MAX_CHOICES } from "./prompt";
import { selectMove } from "./select";
import type { JevMoveRequest, MoveProbability } from "./types";
import { parseMoveRequest } from "./validate";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
// White to move, Qxf7# available (Scholar's mate).
const MATE_IN_ONE = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4";

const moves = (...pairs: string[]): MoveInput[] =>
  pairs.map((pair) => ({ from: pair.slice(0, 2), to: pair.slice(2, 4) }) as MoveInput);

const mockClient = (options?: Parameters<typeof createMockFetch>[0]) =>
  new TypeSafeClient({
    apiKey: "test",
    baseURL: "https://jev-mock.invalid",
    fetch: createMockFetch(options),
    retry: { maxRetries: 0 },
    logLevel: "off",
  });

const request = (overrides: Partial<JevMoveRequest> = {}): JevMoveRequest => ({
  fen: START,
  history: [],
  personality: "balanced",
  difficulty: "hard",
  ...overrides,
});

describe("describeMove", () => {
  const lastMove = (chess: Chess) => chess.history({ verbose: true }).at(-1)!;

  it("describes quiet moves, captures and checks", () => {
    expect(describeMove(lastMove(replay(moves("g1f3"))))).toBe("Knight from g1 to f3");
    expect(describeMove(lastMove(replay(moves("e2e4", "d7d5", "e4d5"))))).toBe(
      "Pawn from e4 to d5, captures a pawn",
    );
    expect(describeMove(lastMove(replay(moves("e2e4", "f7f6", "d1h5"))))).toBe(
      "Queen from d1 to h5, gives check",
    );
  });

  it("describes castling, promotion and mate", () => {
    const castled = replay(moves("e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6", "e1g1"));
    expect(describeMove(lastMove(castled))).toBe("Castles kingside");
    const promoted = replay([{ from: "a7", to: "a8", promotion: "q" }], "8/P6k/8/8/8/8/8/K7 w - - 0 1");
    expect(describeMove(lastMove(promoted))).toBe("Pawn from a7 to a8, promotes to a queen");
    const mated = replay(moves("f2f3", "e7e5", "g2g4", "d8h4"));
    expect(describeMove(lastMove(mated))).toBe("Queen from d8 to h4, delivers checkmate");
  });
});

describe("candidateMoves", () => {
  it("offers every legal move in normal positions", () => {
    expect(candidateMoves(new Chess(START))).toHaveLength(20);
  });

  it("caps the list and keeps the most forcing moves", () => {
    const chess = new Chess(MATE_IN_ONE);
    const capped = candidateMoves(chess, 5);
    expect(capped).toHaveLength(5);
    expect(capped[0]!.san).toBe("Qxf7#");
  });

  it("uses a sensible default cap", () => {
    expect(MAX_CHOICES).toBeGreaterThanOrEqual(40);
  });
});

describe("buildMoveRequest", () => {
  it("offers each legal move in SAN with a description", () => {
    const request = buildMoveRequest(new Chess(START), ["e4"], "aggressive");
    const question = request.questions.move;
    expect(question.type).toBe("choice");
    expect(Object.keys(question.criteria)).toHaveLength(20);
    expect(question.criteria.Nf3).toBe("Knight from g1 to f3");
    expect(String(question.instructions)).toMatch(/as White.*aggressively/);
    expect(request.state).toMatchObject({ side_to_move: "white", in_check: false, recent_moves_san: ["e4"] });
  });

  it("limits the history it sends", () => {
    const history = Array.from({ length: 40 }, (_, i) => (i % 2 ? "Nf6" : "Nf3"));
    const request = buildMoveRequest(new Chess(START), history, "balanced");
    expect((request.state as { recent_moves_san: string[] }).recent_moves_san).toHaveLength(16);
  });
});

describe("selectMove", () => {
  const ranked: MoveProbability[] = [
    { san: "e4", probability: 0.5 },
    { san: "d4", probability: 0.3 },
    { san: "Nf3", probability: 0.15 },
    { san: "a3", probability: 0.05 },
  ];

  it("always plays the top choice on hard", () => {
    for (const roll of [0, 0.5, 0.999]) {
      expect(selectMove(ranked, "hard", "balanced", () => roll)).toBe("e4");
    }
  });

  it("samples only from the top three on medium", () => {
    expect(selectMove(ranked, "medium", "balanced", () => 0)).toBe("e4");
    expect(selectMove(ranked, "medium", "balanced", () => 0.999)).toBe("Nf3");
  });

  it("can reach weaker moves on easy", () => {
    expect(selectMove(ranked, "easy", "balanced", () => 0.999)).toBe("a3");
  });

  it("samples even on hard when the personality is unpredictable", () => {
    expect(selectMove(ranked, "hard", "unpredictable", () => 0.999)).toBe("a3");
  });

  it("rejects an empty list", () => {
    expect(() => selectMove([], "hard", "balanced")).toThrow();
  });
});

describe("mock Jev", () => {
  it("answers in the API's format through the real SDK", async () => {
    const chess = new Chess(START);
    const result = await mockClient().systemOne(buildMoveRequest(chess, [], "balanced"));
    expect(result.model).toBe(MOCK_MODEL);
    const answer = result.answers.move;
    expect(answer.type).toBe("choice");
    expect(chess.moves()).toContain(answer.choice);
    const total = Object.values(answer.probabilities).reduce((sum, p) => sum + p, 0);
    expect(total).toBeCloseTo(1, 6);
    expect(answer.confidence).toBe(answer.probabilities[answer.choice]);
  });

  it("finds a mate in one", async () => {
    const result = await mockClient().systemOne(buildMoveRequest(new Chess(MATE_IN_ONE), [], "positional"));
    expect(result.answers.move.choice).toBe("Qxf7#");
  });

  it("gives the same answer for the same position", async () => {
    const ask = () => mockClient().systemOne(buildMoveRequest(new Chess(START), [], "balanced"));
    expect((await ask()).answers.move).toEqual((await ask()).answers.move);
  });
});

describe("decideMove", () => {
  const quiet = { log: () => {} };

  it("returns a legal move with Jev's top choice and alternatives", async () => {
    const decision = await decideMove({ client: mockClient(), mode: "mock", request: request(), ...quiet });
    expect(decision.source).toBe("mock");
    expect(new Chess(START).moves()).toContain(decision.san);
    expect(decision.topChoice?.san).toBe(decision.san);
    expect(decision.alternatives.length).toBeLessThanOrEqual(5);
    expect(decision.alternatives[0]!.san).toBe(decision.topChoice!.san);
    expect(decision.confidence).toBeGreaterThan(0);
  });

  it("labels live answers as coming from Jev", async () => {
    const decision = await decideMove({ client: mockClient(), mode: "live", request: request(), ...quiet });
    expect(decision.source).toBe("jev");
  });

  it("falls back to a local move when Jev errors, and says why", async () => {
    const log = vi.fn();
    const decision = await decideMove({
      client: mockClient({ failWithStatus: 503 }),
      mode: "live",
      request: request({ fen: MATE_IN_ONE }),
      log,
    });
    expect(decision.source).toBe("fallback");
    expect(decision.fallbackReason).toBe("Jev returned an error (HTTP 503).");
    expect(decision.san).toBe("Qxf7#");
    expect(decision.alternatives).toEqual([]);
    expect(log).toHaveBeenCalledOnce();
  });

  it("falls back when Jev picks a move it was not offered", async () => {
    const client = {
      systemOne: async () => ({
        model: "jev-latest",
        answers: { move: { type: "choice", choice: "Ke2??", confidence: 0.9, probabilities: { "Ke2??": 0.9 } } },
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    } as never;
    const decision = await decideMove({ client, mode: "live", request: request(), ...quiet });
    expect(decision.source).toBe("fallback");
    expect(decision.fallbackReason).toBe("Jev chose a move that is not legal here.");
  });

  it("rethrows when the caller cancels", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      decideMove({ client: mockClient(), mode: "mock", request: request(), signal: controller.signal, ...quiet }),
    ).rejects.toThrow();
  });
});

describe("describeFailure", () => {
  it("has a generic message for unknown errors", () => {
    expect(describeFailure(new Error("boom"))).toBe("Jev returned an answer that could not be used.");
  });
});

describe("parseMoveRequest", () => {
  it("accepts a valid request", () => {
    expect(parseMoveRequest(request({ history: ["e4", "O-O-O", "exd8=Q+"] }))).toEqual({
      ok: true,
      value: request({ history: ["e4", "O-O-O", "exd8=Q+"] }),
    });
  });

  it.each([
    [null, "Expected a JSON object."],
    [{ ...request(), fen: "nope" }, "fen must be a valid FEN string."],
    [{ ...request(), history: "e4" }, "history must be an array of at most 600 moves."],
    [{ ...request(), history: ["<script>"] }, "history must contain moves in SAN."],
    [{ ...request(), personality: "rude" }, "personality is not recognised."],
    [{ ...request(), difficulty: "impossible" }, "difficulty is not recognised."],
  ])("rejects %j", (body, error) => {
    expect(parseMoveRequest(body)).toEqual({ ok: false, error, status: 400 });
  });

  it("rejects a finished game with 422", () => {
    const mated = replay(moves("f2f3", "e7e5", "g2g4", "d8h4")).fen();
    expect(parseMoveRequest(request({ fen: mated }))).toMatchObject({ ok: false, status: 422 });
  });
});
