import { choice, type ChoiceQuestion, type SystemOneRequest } from "@typesafe-ai/sdk";
import { Chess, type Color, type Move } from "chess.js";
import { describeMove, PIECE_NAME } from "@/lib/chess/describe";
import { COLOR_NAME, materialBalance, PIECE_VALUE } from "@/lib/chess/game";
import { moveInterest } from "./heuristic";

export { describeMove };
import type { Score } from "@/lib/stockfish/uci";
import type { PersonalityId } from "./types";

/**
 * The live API accepts at most 255 choices per question and answers 400 above
 * that. No chess position has more than 218 legal moves, so Jev always sees
 * every move; the cap only guards against the limit. Answers took 150 to 500 ms
 * whether a question had 40 choices or 218.
 */
export const MAX_CHOICES = 255;

/** How many recent moves Jev sees as context. */
export const HISTORY_PLIES = 16;

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

/**
 * Whether the moved piece can be taken where it lands, by the opponent's
 * cheapest attacker, and whether anything defends it. Jev cannot see this from
 * the move alone, and without it Jev happily offers pieces for free.
 * `position` is a scratch copy of the position before the move.
 */
export function describeSafety(position: Chess, move: Move): string | null {
  if (move.piece === "k" || move.san.endsWith("#")) return null;
  position.move({ from: move.from, to: move.to, promotion: move.promotion });
  try {
    const defended = position.attackers(move.to, move.color).length > 0;
    const attackers = position
      .attackers(move.to, position.turn())
      .map((square) => position.get(square)!.type)
      // A king cannot take a defended piece.
      .filter((type) => !(type === "k" && defended))
      .sort((a, b) => PIECE_VALUE[a] - PIECE_VALUE[b]);
    if (attackers.length === 0) return null;
    return `there it can be taken by a ${PIECE_NAME[attackers[0]!]}${defended ? "" : " and is not defended"}`;
  } finally {
    position.undo();
  }
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
  const scratch = new Chess(chess.fen());
  for (const move of candidates) {
    const note = stockfish?.get(move.san);
    if (note) {
      criteria[move.san] = `${describeMove(move)}. ${describeStockfishNote(note, turn)}`;
    } else {
      // Stockfish's evaluation already covers safety in hybrid mode.
      const safety = describeSafety(scratch, move);
      criteria[move.san] = safety ? `${describeMove(move)}; ${safety}` : describeMove(move);
    }
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
