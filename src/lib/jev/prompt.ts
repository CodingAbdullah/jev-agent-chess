import { choice, type ChoiceQuestion, type SystemOneRequest } from "@typesafe-ai/sdk";
import type { Chess, Color, Move } from "chess.js";
import { COLOR_NAME, materialBalance } from "@/lib/chess/game";
import { moveInterest } from "./heuristic";
import type { Score } from "@/lib/stockfish/uci";
import type { PersonalityId } from "./types";

/**
 * Most positions have 20 to 40 legal moves, but a few have far more. TypeSafe
 * has not published a limit on choices per question, so cap it and keep the
 * most interesting moves when a position has more.
 */
export const MAX_CHOICES = 60;

/** How many recent moves Jev sees as context. */
export const HISTORY_PLIES = 16;

const PIECE_NAME: Record<string, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

const STYLE: Record<PersonalityId, string> = {
  balanced: "Choose the strongest move.",
  aggressive:
    "Play aggressively: prefer moves that attack the enemy king, open lines and seize the initiative, even at some risk.",
  defensive:
    "Play defensively: prefer moves that keep your king safe, protect your pieces and avoid unnecessary risks.",
  positional:
    "Play positionally: prefer moves that improve your worst piece, control the centre and build a sound pawn structure.",
  tactical:
    "Play tactically: prefer forcing moves such as checks, captures, forks, pins and combinations that win material.",
  unpredictable:
    "Play creatively: prefer sound but unexpected moves that an opponent would not anticipate.",
};

/** A plain description of what a move does, used as the choice's description. */
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

/** The legal moves Jev chooses from, capped at `MAX_CHOICES`. */
export function candidateMoves(chess: Chess, limit = MAX_CHOICES): Move[] {
  const moves = chess.moves({ verbose: true });
  if (moves.length <= limit) return moves;
  return [...moves]
    .map((move, index) => ({ move, index, score: moveInterest(move) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ move }) => move);
}

export type JevQuestions = { move: ChoiceQuestion<Record<string, string>> };

/** Stockfish's view of one shortlisted move, keyed by SAN in `BuildOptions`. */
export type StockfishNote = { rank: number; score: Score; line: readonly string[] };

type BuildOptions = {
  /** The moves to offer. Defaults to every legal move, capped. */
  candidates?: readonly Move[];
  /** Hybrid mode: Stockfish's rank, evaluation and expected line for each candidate. */
  stockfish?: ReadonlyMap<string, StockfishNote>;
};

/** Stockfish's evaluation of a move, from the point of view of the side playing it. */
export function describeStockfishNote(note: StockfishNote, turn: Color): string {
  const score = turn === "w" ? note.score : { ...note.score, value: -note.score.value };
  let verdict: string;
  if (score.type === "mate") {
    verdict =
      score.value > 0
        ? `Stockfish sees mate in ${score.value} for you`
        : `Stockfish sees you getting mated in ${Math.abs(score.value)}`;
  } else {
    const pawns = score.value / 100;
    verdict = `Stockfish evaluation for you: ${pawns >= 0 ? "+" : "-"}${Math.abs(pawns).toFixed(2)} pawns`;
  }
  const parts = [`Stockfish's choice #${note.rank}`, verdict];
  if (note.line[1]) parts.push(`expected reply ${note.line[1]}`);
  return parts.join(", ");
}

/** Build the System One request that asks Jev to pick a move. */
export function buildMoveRequest(
  chess: Chess,
  history: readonly string[],
  personality: PersonalityId,
  { candidates = candidateMoves(chess), stockfish }: BuildOptions = {},
): SystemOneRequest<JevQuestions> {
  const turn = chess.turn();
  const side = COLOR_NAME[turn];
  const balance = materialBalance(chess) * (turn === "w" ? 1 : -1);
  const criteria: Record<string, string> = {};
  for (const move of candidates) {
    const note = stockfish?.get(move.san);
    criteria[move.san] = note ? `${describeMove(move)}. ${describeStockfishNote(note, turn)}` : describeMove(move);
  }

  const instructions = stockfish
    ? `You are playing chess as ${side}. Stockfish, a strong chess engine, has shortlisted these moves, best first, with its evaluations. ${STYLE[personality]} Pick the move that best fits this style without throwing the game away.`
    : `You are playing chess as ${side}. ${STYLE[personality]} Pick one move from the options.`;

  return {
    state: {
      position_fen: chess.fen(),
      side_to_move: side.toLowerCase(),
      move_number: chess.moveNumber(),
      in_check: chess.inCheck(),
      material_balance_for_side_to_move: balance,
      recent_moves_san: history.slice(-HISTORY_PLIES),
    },
    questions: { move: choice(instructions, criteria) },
  };
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
