import type { Move } from "chess.js";

export const PIECE_NAME: Record<string, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

/** A plain description of what a move does, used in Jev's choices and in screen reader announcements. */
export function describeMove(move: Move): string {
  const parts: string[] = [];
  if (move.isKingsideCastle()) parts.push("Castles kingside");
  else if (move.isQueensideCastle()) parts.push("Castles queenside");
  else parts.push(`${capitalize(PIECE_NAME[move.piece]!)} from ${move.from} to ${move.to}`);

  if (move.isEnPassant()) parts.push("captures a pawn en passant");
  else if (move.captured) parts.push(`captures a ${PIECE_NAME[move.captured]}`);
  if (move.promotion) parts.push(`promotes to a ${PIECE_NAME[move.promotion]}`);
  if (move.san.endsWith("#")) parts.push("delivers checkmate");
  else if (move.san.endsWith("+")) parts.push("gives check");
  return parts.join(", ");
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
