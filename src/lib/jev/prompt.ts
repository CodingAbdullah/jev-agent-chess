import {
  choice,
  noul,
  score,
  type ChoiceQuestion,
  type JsonValue,
  type NoulQuestion,
  type ScoreQuestion,
  type SystemOneRequest,
} from "@typesafe-ai/sdk";
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

/**
 * The levels of Jev's evaluation, from Black's side to White's. The live API
 * answers with an expected level and a probability for each.
 */
export const EVALUATION_LEVELS = [
  "Black is winning",
  "Black is clearly better",
  "Black is slightly better",
  "The position is about equal",
  "White is slightly better",
  "White is clearly better",
  "White is winning",
] as const;

/**
 * Plain facts about a position. Jev cannot reliably count material from a FEN
 * alone: without these facts it judged White a queen up as "about equal".
 */
export function positionFacts(chess: Chess, history: readonly string[]) {
  const balance = materialBalance(chess);
  const pieces: Record<Color, string[]> = { w: [], b: [] };
  for (const row of chess.board()) {
    for (const piece of row) {
      if (piece) pieces[piece.color].push(`${PIECE_NAME[piece.type]} on ${piece.square}`);
    }
  }
  return {
    position_fen: chess.fen(),
    side_to_move: COLOR_NAME[chess.turn()].toLowerCase(),
    move_number: chess.moveNumber(),
    in_check: chess.inCheck(),
    material_balance_for_white: balance,
    material:
      balance === 0
        ? "Material is level"
        : `${balance > 0 ? "White" : "Black"} is ahead by ${Math.abs(balance)} points of material (pawn 1, knight 3, bishop 3, rook 5, queen 9)`,
    white_pieces: pieces.w,
    black_pieces: pieces.b,
    recent_moves_san: history.slice(-HISTORY_PLIES),
  };
}

export type EvaluationQuestions = { evaluation: ScoreQuestion<typeof EVALUATION_LEVELS> };

/** Ask Jev who stands better, on the seven levels above. */
export function buildEvaluationRequest(
  chess: Chess,
  history: readonly string[],
): SystemOneRequest<EvaluationQuestions> {
  return {
    state: positionFacts(chess, history),
    questions: {
      evaluation: score(
        "Judge this chess position. Who stands better, and by how much? Material counts most: a side a piece or more ahead is usually clearly better or winning.",
        EVALUATION_LEVELS,
      ),
    },
  };
}

/** How each personality treats a draw offer. */
const DRAW_STYLE: Record<PersonalityId, string> = {
  balanced: "Accept if you have no real winning chances; decline if you are better.",
  aggressive: "You play to win and rarely accept draws. Accept only if you are clearly worse.",
  defensive: "You value safety. Accept when the position is level or you are worse.",
  positional: "Accept when the position is balanced and there is little left to play for.",
  tactical: "Decline while tactics could still decide the game; accept in quiet, level positions.",
  unpredictable: "Decide as you see fit, but do not throw away a winning position.",
};

export type DrawQuestions = { accept: NoulQuestion };

/**
 * Ask Jev whether to accept a draw. In hybrid mode, Stockfish's evaluation of
 * the position, from Jev's side, is part of the state.
 */
export function buildDrawRequest(
  chess: Chess,
  history: readonly string[],
  personality: PersonalityId,
  jevColor: Color,
  stockfishScore?: Score,
): SystemOneRequest<DrawQuestions> {
  const side = COLOR_NAME[jevColor];
  const forJev = materialBalance(chess) * (jevColor === "w" ? 1 : -1);
  const state: Record<string, JsonValue> = {
    ...positionFacts(chess, history),
    you_play: side.toLowerCase(),
    material_balance_for_you: forJev,
  };
  if (stockfishScore) {
    state.stockfish_evaluation_for_you = describeStockfishScore(
      jevColor === "w" ? stockfishScore : { ...stockfishScore, value: -stockfishScore.value },
    );
  }
  return {
    state,
    questions: {
      accept: noul(
        `You are playing chess as ${side}. Your opponent offers a draw. Should you accept it? ${DRAW_STYLE[personality]}`,
        { true: "Accept the draw", false: "Decline and play on" },
      ),
    },
  };
}

function describeStockfishScore(score: Score): string {
  if (score.type === "mate") {
    return score.value > 0 ? `You have mate in ${score.value}` : `You get mated in ${Math.abs(score.value)}`;
  }
  const pawns = score.value / 100;
  return `${pawns >= 0 ? "+" : "-"}${Math.abs(pawns).toFixed(2)} pawns`;
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
