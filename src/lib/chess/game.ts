import {
  Chess,
  DEFAULT_POSITION,
  validateFen,
  type Color,
  type Move,
  type PieceSymbol,
  type Square,
} from "chess.js";

export type { Color, Move, PieceSymbol, Square };
export { DEFAULT_POSITION };

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
  | "fifty-move-rule"
  | "timeout-vs-insufficient-material";

export type GameStatus =
  | { kind: "playing"; turn: Color; inCheck: boolean }
  | { kind: "checkmate"; winner: Color }
  | { kind: "timeout"; winner: Color }
  | { kind: "draw"; reason: DrawReason };

export const COLOR_NAME: Record<Color, string> = { w: "White", b: "Black" };

export const opponent = (color: Color): Color => (color === "w" ? "b" : "w");

const DRAW_REASON_TEXT: Record<DrawReason, string> = {
  stalemate: "stalemate",
  "insufficient-material": "insufficient material",
  "threefold-repetition": "threefold repetition",
  "fifty-move-rule": "the fifty-move rule",
  "timeout-vs-insufficient-material": "timeout against insufficient material",
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

/** Reduce a chess.js move to the fields needed to replay it. */
export function toMoveInput(move: Move): MoveInput {
  const input: MoveInput = { from: move.from, to: move.to };
  if (move.promotion) input.promotion = move.promotion as PromotionPiece;
  return input;
}

/**
 * The game's status. `flagged` is the side whose clock ran out, if any.
 * A side that runs out of time loses, unless the opponent has no way to checkmate.
 */
export function getStatus(chess: Chess, flagged: Color | null = null): GameStatus {
  if (chess.isCheckmate()) {
    return { kind: "checkmate", winner: opponent(chess.turn()) };
  }
  if (flagged) {
    const winner = opponent(flagged);
    return hasMatingMaterial(chess, winner)
      ? { kind: "timeout", winner }
      : { kind: "draw", reason: "timeout-vs-insufficient-material" };
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

export const isGameOver = (status: GameStatus) => status.kind !== "playing";

export function describeStatus(status: GameStatus): string {
  switch (status.kind) {
    case "checkmate":
      return `Checkmate. ${COLOR_NAME[status.winner]} wins.`;
    case "timeout":
      return `${COLOR_NAME[opponent(status.winner)]} ran out of time. ${COLOR_NAME[status.winner]} wins.`;
    case "draw":
      return `Draw by ${DRAW_REASON_TEXT[status.reason]}.`;
    case "playing":
      return status.inCheck
        ? `${COLOR_NAME[status.turn]} is in check.`
        : `${COLOR_NAME[status.turn]} to move.`;
  }
}

/** A short headline for a finished game, such as "Checkmate" or "Stalemate". */
export function statusTitle(status: GameStatus): string {
  switch (status.kind) {
    case "checkmate":
      return "Checkmate";
    case "timeout":
      return "Out of time";
    case "draw":
      return status.reason === "stalemate" ? "Stalemate" : "Draw";
    case "playing":
      return "In progress";
  }
}

/** The PGN result token for a status. */
export function resultToken(status: GameStatus): "1-0" | "0-1" | "1/2-1/2" | "*" {
  switch (status.kind) {
    case "checkmate":
    case "timeout":
      return status.winner === "w" ? "1-0" : "0-1";
    case "draw":
      return "1/2-1/2";
    case "playing":
      return "*";
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

// Material ---------------------------------------------------------------

export const PIECE_VALUE: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

function piecesOf(chess: Chess, color: Color): PieceSymbol[] {
  return chess
    .board()
    .flat()
    .filter((piece) => piece?.color === color)
    .map((piece) => piece!.type);
}

/** White's material minus Black's, in pawns. */
export function materialBalance(chess: Chess): number {
  let balance = 0;
  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece) continue;
      balance += (piece.color === "w" ? 1 : -1) * PIECE_VALUE[piece.type];
    }
  }
  return balance;
}

/**
 * Whether `color` could ever deliver checkmate with its remaining pieces.
 * A lone king, or a king with a single bishop or knight, cannot.
 */
export function hasMatingMaterial(chess: Chess, color: Color): boolean {
  const pieces = piecesOf(chess, color).filter((type) => type !== "k");
  if (pieces.some((type) => type === "p" || type === "r" || type === "q")) return true;
  return pieces.length >= 2;
}

/** Pieces each side has captured during the game, cheapest first. Keyed by the capturing side. */
export function capturedPieces(history: readonly Move[]): Record<Color, PieceSymbol[]> {
  const captured: Record<Color, PieceSymbol[]> = { w: [], b: [] };
  for (const move of history) {
    if (move.captured) captured[move.color].push(move.captured);
  }
  const byValue = (a: PieceSymbol, b: PieceSymbol) => PIECE_VALUE[a] - PIECE_VALUE[b];
  captured.w.sort(byValue);
  captured.b.sort(byValue);
  return captured;
}

// Move list --------------------------------------------------------------

export type MoveRow = {
  number: number;
  white?: { san: string; ply: number };
  black?: { san: string; ply: number };
};

/** Group moves into numbered rows. Handles games that start from a position with Black to move. */
export function moveRows(history: readonly Move[]): MoveRow[] {
  const rows: MoveRow[] = [];
  const first = history[0];
  if (!first) return rows;

  let number = Number(first.before.split(" ")[5]) || 1;
  let row: MoveRow = { number };
  history.forEach((move, ply) => {
    if (move.color === "w") {
      row = { number, white: { san: move.san, ply } };
      rows.push(row);
    } else {
      if (ply === 0) rows.push(row);
      row.black = { san: move.san, ply };
      number += 1;
    }
  });
  return rows;
}

// Import and export ------------------------------------------------------

export type LoadedGame = { startFen?: string; moves: MoveInput[] };

export type ParseResult =
  | { ok: true; game: LoadedGame; format: "fen" | "pgn" }
  | { ok: false; error: string };

const looksLikeFen = (text: string) =>
  !text.includes("[") && !/\d\./.test(text) && text.split("/").length === 8;

/** Read pasted text as either a FEN position or a PGN game. */
export function parseGameText(text: string): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Paste a FEN position or a PGN game first." };

  if (looksLikeFen(trimmed)) {
    const check = validateFen(trimmed);
    if (!check.ok) return { ok: false, error: `That FEN is not valid. ${check.error ?? ""}`.trim() };
    const startFen = trimmed === DEFAULT_POSITION ? undefined : trimmed;
    return { ok: true, format: "fen", game: { startFen, moves: [] } };
  }

  const chess = new Chess();
  try {
    chess.loadPgn(trimmed);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    return { ok: false, error: `That PGN could not be read. ${detail}`.trim() };
  }
  const headers = chess.getHeaders();
  const startFen = headers.SetUp === "1" && headers.FEN ? headers.FEN : undefined;
  const moves = chess.history({ verbose: true }).map(toMoveInput);
  return { ok: true, format: "pgn", game: { startFen, moves } };
}

const pgnDate = (date: Date) =>
  `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;

/** Export a game as PGN with standard headers. */
export function toPgn(
  game: LoadedGame,
  status: GameStatus,
  { date = new Date(), white = "White", black = "Black" } = {},
): string {
  const chess = replay(game.moves, game.startFen);
  chess.setHeader("Event", "Jev Chess game");
  chess.setHeader("Site", "Jev Chess");
  chess.setHeader("Date", pgnDate(date));
  chess.setHeader("White", white);
  chess.setHeader("Black", black);
  chess.setHeader("Result", resultToken(status));
  if (status.kind === "timeout" || (status.kind === "draw" && status.reason === "timeout-vs-insufficient-material")) {
    chess.setHeader("Termination", "time forfeit");
  }
  return chess.pgn();
}
