/**
 * Helpers for the UCI text protocol that Stockfish speaks. Pure functions,
 * free of Workers and React, so they are easy to test.
 */
import { Chess, type Color } from "chess.js";
import type { MoveInput, PromotionPiece } from "@/lib/chess/game";
import type { DifficultyId } from "@/lib/jev/types";

/** A score in centipawns, or moves to mate. Positive is good for the side it is measured for. */
export type Score = { type: "cp"; value: number } | { type: "mate"; value: number };

export type InfoLine = {
  depth: number;
  multipv: number;
  /** From the point of view of the side to move, as UCI reports it. */
  score: Score;
  /** Principal variation in UCI notation, such as ["e2e4", "e7e5"]. */
  pv: string[];
};

const INFO_PATTERN = /\bdepth (\d+)\b.*?\bscore (cp|mate) (-?\d+)/;

/** Parse an `info` line that carries a score and a principal variation. Other lines return null. */
export function parseInfo(line: string): InfoLine | null {
  if (!line.startsWith("info ") || line.includes(" currmove ")) return null;
  const match = INFO_PATTERN.exec(line);
  const pvIndex = line.indexOf(" pv ");
  if (!match || pvIndex === -1) return null;
  const multipv = /\bmultipv (\d+)/.exec(line);
  return {
    depth: Number(match[1]),
    multipv: multipv ? Number(multipv[1]) : 1,
    score: { type: match[2] as "cp" | "mate", value: Number(match[3]) },
    pv: line.slice(pvIndex + 4).trim().split(/\s+/),
  };
}

/** Parse a `bestmove` line. `best` is null when there is no legal move. */
export function parseBestMove(line: string): { best: string | null } | null {
  const match = /^bestmove (\S+)/.exec(line);
  if (!match) return null;
  return { best: match[1] === "(none)" ? null : match[1]! };
}

export function uciToMoveInput(uci: string): MoveInput {
  const input: MoveInput = { from: uci.slice(0, 2), to: uci.slice(2, 4) } as MoveInput;
  if (uci.length > 4) input.promotion = uci[4] as PromotionPiece;
  return input;
}

/** Flip a side-to-move score so that positive always means White is better. */
export function toWhitePerspective(score: Score, turn: Color): Score {
  return turn === "w" ? score : { type: score.type, value: -score.value };
}

/** "+0.25", "-1.30", "0.00", "M3" or "-M2". Expects White's perspective. */
export function formatScore(score: Score): string {
  if (score.type === "mate") {
    if (score.value === 0) return "#";
    return `${score.value < 0 ? "-" : ""}M${Math.abs(score.value)}`;
  }
  const pawns = score.value / 100;
  if (Math.abs(pawns) < 0.005) return "0.00";
  return `${pawns > 0 ? "+" : "-"}${Math.abs(pawns).toFixed(2)}`;
}

/**
 * White's share of the evaluation bar, from 0 to 1. Uses the winning-chance
 * curve Lichess uses, so small advantages move the bar gently and large ones
 * approach the ends without reaching them. Mate fills the bar.
 */
export function whiteShare(score: Score): number {
  if (score.type === "mate") {
    if (score.value === 0) return 0.5;
    return score.value > 0 ? 1 : 0;
  }
  return 1 / (1 + Math.exp(-0.00368208 * score.value));
}

/** A short description of an evaluation, for screen readers and captions. */
export function describeScore(score: Score): string {
  if (score.type === "mate") {
    if (score.value === 0) return "Checkmate on the board";
    const side = score.value > 0 ? "White" : "Black";
    return `${side} mates in ${Math.abs(score.value)}`;
  }
  const pawns = Math.abs(score.value) / 100;
  if (pawns < 0.3) return "The position is about equal";
  const side = score.value > 0 ? "White" : "Black";
  if (pawns < 1) return `${side} is slightly better`;
  if (pawns < 3) return `${side} is better`;
  return `${side} is winning`;
}

/** Convert a UCI line to SAN, stopping at the first move that is not legal. */
export function pvToSan(fen: string, pv: readonly string[], limit = 8): string[] {
  const chess = new Chess(fen);
  const san: string[] = [];
  for (const uci of pv.slice(0, limit)) {
    try {
      san.push(chess.move(uciToMoveInput(uci)).san);
    } catch {
      break;
    }
  }
  return san;
}

/**
 * How difficulty limits Stockfish. Skill Level (0 to 20) makes it choose
 * weaker moves on purpose, and depth and time cap how far it looks.
 */
export const STOCKFISH_LEVELS: Record<DifficultyId, { skill: number; depth: number; movetimeMs: number }> = {
  easy: { skill: 2, depth: 4, movetimeMs: 400 },
  medium: { skill: 8, depth: 8, movetimeMs: 800 },
  hard: { skill: 20, depth: 16, movetimeMs: 1_500 },
};

/** Settings for the evaluation bar's background analysis. */
export const ANALYSIS_LIMITS = { depth: 16, movetimeMs: 1_500 };
