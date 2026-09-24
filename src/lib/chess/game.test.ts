import { describe, expect, it } from "vitest";
import {
  describeStatus,
  getStatus,
  isOwnPiece,
  isSquare,
  kingSquare,
  legalMovesFrom,
  needsPromotion,
  replay,
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
