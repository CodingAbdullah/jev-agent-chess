import { Chess } from "chess.js";
import type { DifficultyId } from "@/lib/jev/types";
import type { StockfishEngine } from "./engine";
import { pvToSan, STOCKFISH_LEVELS, toWhitePerspective, uciToMoveInput, type Score } from "./uci";

export type StockfishMove = {
  move: ReturnType<typeof uciToMoveInput>;
  san: string;
  /** Stockfish's evaluation of the position before its move, from White's side. */
  score: Score | null;
  depth: number;
  /** The line Stockfish expects, in SAN, starting with its move. */
  line: string[];
  difficulty: DifficultyId;
};

/** Ask Stockfish for a move at the given difficulty. */
export async function stockfishMove(
  engine: StockfishEngine,
  fen: string,
  difficulty: DifficultyId,
  signal: AbortSignal,
): Promise<StockfishMove> {
  const level = STOCKFISH_LEVELS[difficulty];
  const result = await engine.search(fen, {
    depth: level.depth,
    movetimeMs: level.movetimeMs,
    skill: level.skill,
    signal,
  });
  if (!result.bestMove) throw new Error("Stockfish found no legal move in this position.");

  const [san] = pvToSan(fen, [result.bestMove]);
  if (!san) throw new Error("Stockfish suggested a move that is not legal here.");

  const top = result.lines[0];
  const turn = new Chess(fen).turn();
  // Below full strength, Stockfish may deliberately play something other than its main line.
  const line = top && top.pv[0] === result.bestMove ? pvToSan(fen, top.pv, 6) : [san];
  return {
    move: uciToMoveInput(result.bestMove),
    san,
    score: top ? toWhitePerspective(top.score, turn) : null,
    depth: top?.depth ?? 0,
    line,
    difficulty,
  };
}
