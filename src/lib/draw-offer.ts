import { Chess, type Color } from "chess.js";
import { opponent } from "./chess/game";
import type { AiConfig } from "./game-config";
import { requestJevDraw } from "./jev/api";
import type { JevDrawRequest, JevDrawResponse, JevSource } from "./jev/types";
import type { StockfishEngine } from "./stockfish/engine";
import { formatScore, toWhitePerspective, type Score } from "./stockfish/uci";

/** Computer opponents consider draw offers from this move on. */
export const FIRST_DRAW_MOVE = 10;

/** Stockfish accepts a draw unless it is better by more than this, in centipawns. */
export const STOCKFISH_ACCEPTS_UP_TO = 25;

/** A quick, full-strength look at the position, enough to judge a draw offer. */
export const DRAW_SEARCH = { depth: 12, movetimeMs: 800, skill: 20 };

export type DrawAnswer = {
  accept: boolean;
  /** A sentence for the player, such as "Stockfish declines: it thinks it is better (+1.35)." */
  message: string;
  /** Where a Jev answer came from. */
  source?: JevSource;
};

type AskOptions = {
  config: AiConfig;
  fen: string;
  history: string[];
  getEngine: () => StockfishEngine;
  signal: AbortSignal;
  askJev?: (request: JevDrawRequest, signal: AbortSignal) => Promise<JevDrawResponse>;
};

/** Stockfish's evaluation of the position, from White's side. */
async function stockfishScore(engine: StockfishEngine, fen: string, signal: AbortSignal): Promise<Score | null> {
  const result = await engine.search(fen, { ...DRAW_SEARCH, signal });
  const top = result.lines[0];
  return top ? toWhitePerspective(top.score, new Chess(fen).turn()) : null;
}

/** Stockfish's own rule: accept unless it is clearly better. */
export function stockfishAnswer(score: Score | null, stockfishColor: Color): DrawAnswer {
  if (!score) return { accept: true, message: "Stockfish accepts the draw." };
  const own = stockfishColor === "w" ? score : { ...score, value: -score.value };
  const shown = formatScore(own);
  if (own.type === "mate") {
    return own.value > 0
      ? { accept: false, message: `Stockfish declines: it sees a forced mate (${shown}).` }
      : { accept: true, message: `Stockfish accepts: it sees itself getting mated (${shown}).` };
  }
  if (own.value > STOCKFISH_ACCEPTS_UP_TO) {
    return { accept: false, message: `Stockfish declines: it thinks it is better (${shown}).` };
  }
  return {
    accept: true,
    message: `Stockfish accepts: it judges the position ${own.value < -STOCKFISH_ACCEPTS_UP_TO ? "worse for itself" : "level"} (${shown}).`,
  };
}

/** Turn Jev's answer into a sentence, saying how sure it was or why a fallback decided. */
export function jevAnswer(response: JevDrawResponse, name: string): DrawAnswer {
  const verdict = response.accept ? "accepts" : "declines";
  if (response.source === "fallback") {
    return {
      accept: response.accept,
      source: response.source,
      message: `${name} ${verdict}. ${response.fallbackReason ?? "Jev could not be asked"} A simple rule decided instead.`,
    };
  }
  const yes = Math.round((response.probability ?? (response.accept ? 1 : 0)) * 100);
  return {
    accept: response.accept,
    source: response.source,
    message: `${name} ${verdict} the draw (${yes}% for accepting).`,
  };
}

/**
 * Offer the computer a draw and get its answer. It always declines before
 * move 10, so a game cannot be drawn straight away. Otherwise Stockfish judges
 * by its own evaluation, Jev answers a yes or no question on the server, and in
 * hybrid mode Jev decides with Stockfish's evaluation in front of it.
 */
export async function askForDraw({ config, fen, history, getEngine, signal, askJev = requestJevDraw }: AskOptions): Promise<DrawAnswer> {
  const name = config.mode === "stockfish" ? "Stockfish" : config.mode === "jev" ? "Jev" : "Jev + Stockfish";
  if (new Chess(fen).moveNumber() < FIRST_DRAW_MOVE) {
    return {
      accept: false,
      message: `${name} declines: it is too early for a draw. Offers are considered from move ${FIRST_DRAW_MOVE}.`,
    };
  }
  const computer = opponent(config.humanColor);
  if (config.mode === "stockfish") {
    return stockfishAnswer(await stockfishScore(getEngine(), fen, signal), computer);
  }
  const score = config.mode === "hybrid" ? await stockfishScore(getEngine(), fen, signal) : null;
  const response = await askJev(
    { fen, history, personality: config.personality, jevColor: computer, ...(score ? { stockfishScore: score } : {}) },
    signal,
  );
  return jevAnswer(response, name);
}
