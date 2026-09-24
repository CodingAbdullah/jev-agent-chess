import { Chess, type Color, type Move, type Square } from "chess.js";

export type { Color, Move, Square };

export type PromotionPiece = "q" | "r" | "b" | "n";

export const PROMOTION_PIECES: readonly PromotionPiece[] = ["q", "r", "b", "n"];

/** The minimum needed to replay a move: where it came from, where it went, and any promotion. */
export type MoveInput = {
  from: Square;
  to: Square;
  promotion?: PromotionPiece;
};

export type DrawReason =
  | "stalemate"
  | "insufficient-material"
  | "threefold-repetition"
  | "fifty-move-rule";

export type GameStatus =
  | { kind: "playing"; turn: Color; inCheck: boolean }
  | { kind: "checkmate"; winner: Color }
  | { kind: "draw"; reason: DrawReason };

export const COLOR_NAME: Record<Color, string> = { w: "White", b: "Black" };

const DRAW_REASON_TEXT: Record<DrawReason, string> = {
  stalemate: "stalemate",
  "insufficient-material": "insufficient material",
  "threefold-repetition": "threefold repetition",
  "fifty-move-rule": "the fifty-move rule",
};

/**
 * Build a game by replaying moves from a starting position.
 * Replaying keeps the full history, which threefold repetition detection needs.
 * Throws if any move is illegal.
 */
export function replay(moves: readonly MoveInput[], startFen?: string): Chess {
  const chess = new Chess(startFen);
  for (const move of moves) {
    chess.move(move);
  }
  return chess;
}

/** Try a move on the given game. Returns the move, or null if it is illegal. Mutates `chess` on success. */
export function tryMove(chess: Chess, input: MoveInput): Move | null {
  try {
    return chess.move(input);
  } catch {
    return null;
  }
}

export function getStatus(chess: Chess): GameStatus {
  if (chess.isCheckmate()) {
    return { kind: "checkmate", winner: chess.turn() === "w" ? "b" : "w" };
  }
  if (chess.isStalemate()) return { kind: "draw", reason: "stalemate" };
  if (chess.isInsufficientMaterial()) {
    return { kind: "draw", reason: "insufficient-material" };
  }
  if (chess.isThreefoldRepetition()) {
    return { kind: "draw", reason: "threefold-repetition" };
  }
  if (chess.isDrawByFiftyMoves()) {
    return { kind: "draw", reason: "fifty-move-rule" };
  }
  return { kind: "playing", turn: chess.turn(), inCheck: chess.inCheck() };
}

export function describeStatus(status: GameStatus): string {
  switch (status.kind) {
    case "checkmate":
      return `Checkmate. ${COLOR_NAME[status.winner]} wins.`;
    case "draw":
      return `Draw by ${DRAW_REASON_TEXT[status.reason]}.`;
    case "playing":
      return status.inCheck
        ? `${COLOR_NAME[status.turn]} is in check.`
        : `${COLOR_NAME[status.turn]} to move.`;
  }
}

/** Legal moves for the piece on `square`. Empty if there is no piece or it is not that side's turn. */
export function legalMovesFrom(chess: Chess, square: Square): Move[] {
  return chess.moves({ square, verbose: true });
}

/** True when moving from `from` to `to` is legal and requires choosing a promotion piece. */
export function needsPromotion(chess: Chess, from: Square, to: Square): boolean {
  return legalMovesFrom(chess, from).some(
    (move) => move.to === to && move.isPromotion(),
  );
}

/** True when the piece on `square` belongs to the side to move. */
export function isOwnPiece(chess: Chess, square: Square): boolean {
  return chess.get(square)?.color === chess.turn();
}

export function kingSquare(chess: Chess, color: Color): Square | undefined {
  return chess.findPiece({ type: "k", color })[0];
}

const SQUARE_PATTERN = /^[a-h][1-8]$/;

export function isSquare(value: string | null | undefined): value is Square {
  return typeof value === "string" && SQUARE_PATTERN.test(value);
}
