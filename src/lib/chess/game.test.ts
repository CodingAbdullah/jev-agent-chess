import { describe, expect, it } from "vitest";
import {
  capturedPieces,
  describeStatus,
  getStatus,
  hasMatingMaterial,
  isOwnPiece,
  isSquare,
  kingSquare,
  legalMovesFrom,
  materialBalance,
  moveRows,
  needsPromotion,
  parseGameText,
  replay,
  resultToken,
  toPgn,
  tryMove,
  type MoveInput,
} from "./game";

const moves = (...pairs: string[]): MoveInput[] =>
  pairs.map((pair) => {
    const [from, to, promotion] = pair.split("-");
    return { from, to, promotion } as MoveInput;
  });

describe("replay", () => {
  it("starts from the initial position with no moves", () => {
    expect(replay([]).fen()).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    );
  });

  it("throws on an illegal move", () => {
    expect(() => replay(moves("e2-e5"))).toThrow();
  });
});

describe("tryMove", () => {
  it("returns null for an illegal move and leaves the game unchanged", () => {
    const chess = replay([]);
    const before = chess.fen();
    expect(tryMove(chess, { from: "e2", to: "e5" })).toBeNull();
    expect(chess.fen()).toBe(before);
  });

  it("returns the move for a legal move", () => {
    const chess = replay([]);
    expect(tryMove(chess, { from: "g1", to: "f3" })?.san).toBe("Nf3");
  });
});

describe("special moves", () => {
  it("allows kingside castling once the path is clear", () => {
    const chess = replay(moves("e2-e4", "e7-e5", "g1-f3", "b8-c6", "f1-c4", "g8-f6"));
    const castle = tryMove(chess, { from: "e1", to: "g1" });
    expect(castle?.isKingsideCastle()).toBe(true);
    expect(chess.get("f1")).toEqual({ type: "r", color: "w" });
  });

  it("captures en passant", () => {
    const chess = replay(moves("e2-e4", "a7-a6", "e4-e5", "d7-d5"));
    const capture = tryMove(chess, { from: "e5", to: "d6" });
    expect(capture?.isEnPassant()).toBe(true);
    expect(chess.get("d5")).toBeUndefined();
  });

  it("detects promotion and promotes to the chosen piece", () => {
    const chess = replay([], "8/P6k/8/8/8/8/8/K7 w - - 0 1");
    expect(needsPromotion(chess, "a7", "a8")).toBe(true);
    expect(needsPromotion(chess, "a1", "a2")).toBe(false);
    tryMove(chess, { from: "a7", to: "a8", promotion: "n" });
    expect(chess.get("a8")).toEqual({ type: "n", color: "w" });
  });
});

describe("getStatus", () => {
  it("reports whose turn it is", () => {
    expect(getStatus(replay([]))).toEqual({ kind: "playing", turn: "w", inCheck: false });
  });

  it("reports check", () => {
    const status = getStatus(replay(moves("e2-e4", "f7-f6", "d1-h5")));
    expect(status).toEqual({ kind: "playing", turn: "b", inCheck: true });
    expect(describeStatus(status)).toBe("Black is in check.");
  });

  it("reports checkmate with the winner", () => {
    const status = getStatus(replay(moves("f2-f3", "e7-e5", "g2-g4", "d8-h4")));
    expect(status).toEqual({ kind: "checkmate", winner: "b" });
    expect(describeStatus(status)).toBe("Checkmate. Black wins.");
  });

  it("reports stalemate", () => {
    const status = getStatus(replay([], "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"));
    expect(status).toEqual({ kind: "draw", reason: "stalemate" });
    expect(describeStatus(status)).toBe("Draw by stalemate.");
  });

  it("reports insufficient material", () => {
    expect(getStatus(replay([], "8/8/4k3/8/8/4K3/8/8 w - - 0 1"))).toEqual({
      kind: "draw",
      reason: "insufficient-material",
    });
  });

  it("reports threefold repetition", () => {
    const shuffle = moves("g1-f3", "g8-f6", "f3-g1", "f6-g8");
    expect(getStatus(replay([...shuffle, ...shuffle]))).toEqual({
      kind: "draw",
      reason: "threefold-repetition",
    });
  });

  it("reports the fifty-move rule", () => {
    expect(getStatus(replay([], "8/8/4k3/8/8/4K3/4R3/8 w - - 100 80"))).toEqual({
      kind: "draw",
      reason: "fifty-move-rule",
    });
  });
});

describe("helpers", () => {
  it("lists legal destinations for a piece", () => {
    const targets = legalMovesFrom(replay([]), "g1").map((m) => m.to).sort();
    expect(targets).toEqual(["f3", "h3"]);
  });

  it("returns no moves for the side not on move", () => {
    expect(legalMovesFrom(replay([]), "e7")).toEqual([]);
  });

  it("knows whose pieces can move", () => {
    const chess = replay([]);
    expect(isOwnPiece(chess, "e2")).toBe(true);
    expect(isOwnPiece(chess, "e7")).toBe(false);
    expect(isOwnPiece(chess, "e4")).toBe(false);
  });

  it("finds the king", () => {
    expect(kingSquare(replay([]), "b")).toBe("e8");
  });

  it("validates square names", () => {
    expect(isSquare("a1")).toBe(true);
    expect(isSquare("h8")).toBe(true);
    expect(isSquare("i1")).toBe(false);
    expect(isSquare(null)).toBe(false);
  });
});

describe("timeouts", () => {
  it("awards the win to the opponent when they can still mate", () => {
    const status = getStatus(replay([]), "w");
    expect(status).toEqual({ kind: "timeout", winner: "b" });
    expect(describeStatus(status)).toBe("White ran out of time. Black wins.");
    expect(resultToken(status)).toBe("0-1");
  });

  it("is a draw when the opponent has only a king and a knight", () => {
    const chess = replay([], "4k3/8/8/8/8/8/3PN3/4K3 w - - 0 1");
    expect(getStatus(chess, "b")).toEqual({ kind: "timeout", winner: "w" });
    const knightOnly = replay([], "4k3/8/8/8/8/8/4N3/4K3 w - - 0 1");
    expect(getStatus(knightOnly, "b")).toEqual({
      kind: "draw",
      reason: "timeout-vs-insufficient-material",
    });
  });

  it("lets checkmate stand even if a flag arrives", () => {
    const mated = replay(moves("f2-f3", "e7-e5", "g2-g4", "d8-h4"));
    expect(getStatus(mated, "b")).toEqual({ kind: "checkmate", winner: "b" });
  });
});

describe("hasMatingMaterial", () => {
  it.each([
    ["4k3/8/8/8/8/8/8/4K3 w - - 0 1", false],
    ["4k3/8/8/8/8/8/4B3/4K3 w - - 0 1", false],
    ["4k3/8/8/8/8/8/3BN3/4K3 w - - 0 1", true],
    ["4k3/8/8/8/8/8/4R3/4K3 w - - 0 1", true],
    ["4k3/8/8/8/8/8/4P3/4K3 w - - 0 1", true],
  ])("%s gives White mating material: %s", (fen, expected) => {
    expect(hasMatingMaterial(replay([], fen), "w")).toBe(expected);
  });
});

describe("material", () => {
  it("is balanced at the start", () => {
    expect(materialBalance(replay([]))).toBe(0);
  });

  it("tracks captures and the material lead", () => {
    // 1. e4 d5 2. exd5 Qxd5 3. Nc3 Qxa2 4. Rxa2
    const chess = replay(moves("e2-e4", "d7-d5", "e4-d5", "d8-d5", "b1-c3", "d5-a2", "a1-a2"));
    expect(capturedPieces(chess.history({ verbose: true }))).toEqual({ w: ["p", "q"], b: ["p", "p"] });
    expect(materialBalance(chess)).toBe(8);
  });
});

describe("moveRows", () => {
  it("numbers moves in pairs", () => {
    const rows = moveRows(replay(moves("e2-e4", "e7-e5", "g1-f3")).history({ verbose: true }));
    expect(rows).toEqual([
      { number: 1, white: { san: "e4", ply: 0 }, black: { san: "e5", ply: 1 } },
      { number: 2, white: { san: "Nf3", ply: 2 } },
    ]);
  });

  it("starts with an empty White slot when Black moves first", () => {
    const chess = replay(moves("e8-d7", "e1-d1"), "4k3/8/8/8/8/8/4P3/4K3 b - - 0 12");
    expect(moveRows(chess.history({ verbose: true }))).toEqual([
      { number: 12, black: { san: "Kd7", ply: 0 } },
      { number: 13, white: { san: "Kd1", ply: 1 } },
    ]);
  });

  it("is empty with no moves", () => {
    expect(moveRows([])).toEqual([]);
  });
});

describe("parseGameText", () => {
  it("reads a FEN position", () => {
    const fen = "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1";
    expect(parseGameText(`  ${fen}\n`)).toEqual({ ok: true, format: "fen", game: { startFen: fen, moves: [] } });
  });

  it("treats the standard starting FEN as a fresh game", () => {
    expect(parseGameText("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")).toEqual({
      ok: true,
      format: "fen",
      game: { startFen: undefined, moves: [] },
    });
  });

  it("reports an invalid FEN", () => {
    const result = parseGameText("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w XYZ - 0 1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/FEN is not valid/);
  });

  it("reads a PGN game", () => {
    const result = parseGameText('[Event "Test"]\n\n1. e4 e5 2. Nf3 *');
    expect(result).toEqual({
      ok: true,
      format: "pgn",
      game: { startFen: undefined, moves: moves("e2-e4", "e7-e5", "g1-f3") },
    });
  });

  it("reads a PGN that starts from a custom position", () => {
    const pgn = '[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/4P3/4K3 b - - 0 10"]\n\n10... Kd7 *';
    const result = parseGameText(pgn);
    expect(result.ok && result.game).toEqual({
      startFen: "4k3/8/8/8/8/8/4P3/4K3 b - - 0 10",
      moves: moves("e8-d7"),
    });
  });

  it("reports an illegal PGN", () => {
    const result = parseGameText("1. e4 e5 2. Qxf7");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/PGN could not be read/);
  });

  it("asks for input when empty", () => {
    expect(parseGameText("   ")).toEqual({ ok: false, error: "Paste a FEN position or a PGN game first." });
  });
});

describe("toPgn", () => {
  it("exports headers, moves and the result, and round-trips", () => {
    const game = { moves: moves("f2-f3", "e7-e5", "g2-g4", "d8-h4") };
    const pgn = toPgn(game, { kind: "checkmate", winner: "b" }, { date: new Date(2026, 8, 24) });
    expect(pgn).toContain('[Date "2026.09.24"]');
    expect(pgn).toContain('[Result "0-1"]');
    expect(pgn).toContain("1. f3 e5 2. g4 Qh4# 0-1");
    const reread = parseGameText(pgn);
    expect(reread.ok && reread.game).toEqual({ startFen: undefined, moves: game.moves });
  });

  it("marks time forfeits", () => {
    const pgn = toPgn({ moves: moves("e2-e4") }, { kind: "timeout", winner: "w" });
    expect(pgn).toContain('[Termination "time forfeit"]');
    expect(pgn).toContain('[Result "1-0"]');
  });
});

describe("describeStatus with player names", () => {
  const names = { w: "You", b: "Jev" } as const;

  it("names the winner", () => {
    expect(describeStatus({ kind: "checkmate", winner: "b" }, names)).toBe("Checkmate. Jev wins.");
    expect(describeStatus({ kind: "checkmate", winner: "w" }, names)).toBe("Checkmate. You win.");
    expect(describeStatus({ kind: "timeout", winner: "b" }, names)).toBe("You ran out of time. Jev wins.");
  });
});
