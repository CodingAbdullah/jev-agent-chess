import { Chess } from "chess.js";
import type { MoveInput } from "./chess/game";
import { requestJevMove } from "./jev/api";
import type {
  DifficultyId,
  JevMoveRequest,
  JevMoveResponse,
  PersonalityId,
  StockfishCandidate,
} from "./jev/types";
import type { StockfishEngine } from "./stockfish/engine";
import { pvToSan, toWhitePerspective, uciToMoveInput, type Score } from "./stockfish/uci";

/** How many moves Stockfish shortlists for Jev. */
export const SHORTLIST_SIZE = 5;

/**
 * Hybrid difficulty sets how deeply Stockfish searches for its shortlist. It
 * always searches at full skill, so the shortlist is sound. Jev then applies
 * the same difficulty when turning its probabilities into a move.
 */
export const HYBRID_LEVELS: Record<DifficultyId, { depth: number; movetimeMs: number }> = {
  easy: { depth: 6, movetimeMs: 500 },
  medium: { depth: 10, movetimeMs: 900 },
  hard: { depth: 16, movetimeMs: 1_500 },
};

export type ShortlistEntry = {
  san: string;
  /** Stockfish's rank, 1 for its best move. */
  rank: number;
  /** Stockfish's evaluation after this move, from White's side. */
  score: Score;
  /** Jev's probability for this move. Missing when Jev did not answer. */
  probability?: number;
};

export type HybridMove = {
  move: MoveInput;
  san: string;
  shortlist: ShortlistEntry[];
  depth: number;
  /** Jev's answer, or null when only one move was worth considering. */
  jev: JevMoveResponse | null;
};

type HybridOptions = {
  engine: StockfishEngine;
  fen: string;
  history: string[];
  personality: PersonalityId;
  difficulty: DifficultyId;
  signal: AbortSignal;
  askJev?: (request: JevMoveRequest, signal: AbortSignal) => Promise<JevMoveResponse>;
};

/** Stockfish shortlists its best moves, then Jev picks one that fits its personality. */
export async function hybridMove({
  engine,
  fen,
  history,
  personality,
  difficulty,
  signal,
  askJev = requestJevMove,
}: HybridOptions): Promise<HybridMove> {
  const level = HYBRID_LEVELS[difficulty];
  const result = await engine.search(fen, {
    depth: level.depth,
    movetimeMs: level.movetimeMs,
    skill: 20,
    multipv: SHORTLIST_SIZE,
    signal,
  });

  const turn = new Chess(fen).turn();
  const candidates: (StockfishCandidate & { san: string })[] = [];
  for (const line of result.lines) {
    const uci = line.pv[0];
    if (!uci || candidates.some((candidate) => candidate.uci === uci)) continue;
    const sanLine = pvToSan(fen, line.pv, 4);
    if (sanLine.length === 0) continue;
    candidates.push({ uci, san: sanLine[0]!, score: toWhitePerspective(line.score, turn), line: sanLine });
  }
  if (candidates.length === 0 && result.bestMove) {
    const [san] = pvToSan(fen, [result.bestMove]);
    if (san) candidates.push({ uci: result.bestMove, san, score: { type: "cp", value: 0 }, line: [san] });
  }
  if (candidates.length === 0) throw new Error("Stockfish found no moves to shortlist.");

  const depth = Math.max(0, ...result.lines.map((line) => line.depth));
  const shortlist = (probabilities?: Map<string, number>): ShortlistEntry[] =>
    candidates.map((candidate, index) => ({
      san: candidate.san,
      rank: index + 1,
      score: candidate.score,
      probability: probabilities?.get(candidate.san),
    }));

  // With a single sensible move there is nothing for Jev to choose.
  if (candidates.length === 1) {
    const only = candidates[0]!;
    return { move: uciToMoveInput(only.uci), san: only.san, shortlist: shortlist(), depth, jev: null };
  }

  const jev = await askJev(
    {
      fen,
      history,
      personality,
      difficulty,
      candidates: candidates.map(({ uci, score, line }) => ({ uci, score, line })),
    },
    signal,
  );
  const probabilities = new Map(jev.alternatives.map((entry) => [entry.san, entry.probability]));
  return { move: jev.move, san: jev.san, shortlist: shortlist(probabilities), depth, jev };
}
