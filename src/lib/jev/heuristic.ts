import type { Move } from "chess.js";
import { PIECE_VALUE } from "@/lib/chess/game";

/**
 * A quick, shallow score for how interesting a move looks. It is not chess
 * strength. It orders candidates when there are too many to send, drives the
 * mock Jev, and picks the fallback move when Jev is unavailable.
 */
export function moveInterest(move: Move): number {
  let score = 0;
  if (move.san.endsWith("#")) score += 100;
  else if (move.san.endsWith("+")) score += 2;
  if (move.captured) score += PIECE_VALUE[move.captured] * 1.5 - PIECE_VALUE[move.piece] * 0.2;
  if (move.promotion) score += PIECE_VALUE[move.promotion];
  if (move.isKingsideCastle() || move.isQueensideCastle()) score += 1.5;
  // Developing minor pieces off the back rank early is usually sensible.
  if ((move.piece === "n" || move.piece === "b") && (move.from[1] === "1" || move.from[1] === "8")) {
    score += 0.8;
  }
  // Knights on the edge of the board control few squares.
  if (move.piece === "n" && /^[ah]/.test(move.to)) score -= 1.2;
  // Central pawn moves.
  if (move.piece === "p" && /^[de][45]$/.test(move.to)) score += 1.2;
  // Early king walks are rarely good.
  if (move.piece === "k" && !move.isKingsideCastle() && !move.isQueensideCastle()) score -= 1;
  return score;
}

/** The move with the highest interest. Ties go to the first move. */
export function bestByInterest(moves: readonly Move[]): Move | undefined {
  let best: Move | undefined;
  let bestScore = -Infinity;
  for (const move of moves) {
    const score = moveInterest(move);
    if (score > bestScore) {
      best = move;
      bestScore = score;
    }
  }
  return best;
}
