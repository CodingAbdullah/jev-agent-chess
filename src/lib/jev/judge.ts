import { APIUserAbortError } from "@typesafe-ai/sdk";
import { Chess, type Color } from "chess.js";
import { materialBalance } from "@/lib/chess/game";
import type { Score } from "@/lib/stockfish/uci";
import type { JevClient, JevMode } from "./client";
import { describeFailure } from "./decide";
import { buildDrawRequest, buildEvaluationRequest, EVALUATION_LEVELS } from "./prompt";
import type { JevDrawResponse, JevEvaluation, PersonalityId } from "./types";

const TOP_LEVEL = EVALUATION_LEVELS.length - 1;

/** Jev accepts a draw when its probability of yes reaches this. */
export const ACCEPT_THRESHOLD = 0.5;

/** A failed Jev call, with a reason that is safe to show to players. */
export class JevUnavailableError extends Error {}

type JudgeOptions = {
  client: JevClient;
  mode: JevMode;
  fen: string;
  history: readonly string[];
  signal?: AbortSignal;
  now?: () => number;
  log?: (message: string) => void;
};

/**
 * Ask Jev who stands better. There is no local stand-in for Jev's judgment,
 * so a failure throws `JevUnavailableError` and the browser shows Stockfish's
 * evaluation instead.
 */
export async function evaluatePosition({
  client,
  mode,
  fen,
  history,
  signal,
  now = Date.now,
  log = (message) => console.warn(message),
}: JudgeOptions): Promise<JevEvaluation> {
  const started = now();
  try {
    const result = await client.systemOne(buildEvaluationRequest(new Chess(fen), history), { signal });
    const answer = result.answers?.evaluation;
    if (answer?.type !== "score" || !Number.isFinite(answer.score)) {
      throw new JevUnavailableError("Jev did not answer the evaluation question.");
    }
    const score = Math.min(TOP_LEVEL, Math.max(0, answer.score));
    // The most likely level names the verdict; the expected score places the bar.
    let level = Math.round(score);
    let confidence = 0;
    for (const [key, probability] of Object.entries(answer.probabilities ?? {})) {
      const index = Number(key);
      if (Number.isInteger(index) && index >= 0 && index <= TOP_LEVEL && Number(probability) > confidence) {
        level = index;
        confidence = Number(probability);
      }
    }
    return {
      source: mode === "live" ? "jev" : "mock",
      score,
      whiteShare: score / TOP_LEVEL,
      verdict: EVALUATION_LEVELS[level]!,
      confidence: confidence || answer.confidence,
      model: result.model,
      latencyMs: now() - started,
    };
  } catch (error) {
    if (error instanceof APIUserAbortError || signal?.aborted) throw error;
    const reason = error instanceof JevUnavailableError ? error.message : describeFailure(error);
    log(`Jev evaluation failed: ${reason} ${error instanceof Error ? `(${error.name}: ${error.message})` : ""}`);
    throw new JevUnavailableError(reason);
  }
}

/**
 * The fallback's answer to a draw offer: accept only when behind on material,
 * or when Stockfish, in hybrid mode, says Jev is worse.
 */
export function fallbackAcceptsDraw(chess: Chess, jevColor: Color, stockfishScore?: Score): boolean {
  if (stockfishScore) {
    const forJev = jevColor === "w" ? stockfishScore.value : -stockfishScore.value;
    return stockfishScore.type === "mate" ? forJev < 0 : forJev <= -50;
  }
  return materialBalance(chess) * (jevColor === "w" ? 1 : -1) < 0;
}

/**
 * Ask Jev whether to accept a draw. If Jev fails for any reason other than the
 * caller cancelling, a simple rule decides instead and the response says why.
 */
export async function decideDraw({
  client,
  mode,
  fen,
  history,
  personality,
  jevColor,
  stockfishScore,
  signal,
  now = Date.now,
  log = (message) => console.warn(message),
}: JudgeOptions & { personality: PersonalityId; jevColor: Color; stockfishScore?: Score }): Promise<JevDrawResponse> {
  const started = now();
  const chess = new Chess(fen);
  try {
    const result = await client.systemOne(
      buildDrawRequest(chess, history, personality, jevColor, stockfishScore),
      { signal },
    );
    const answer = result.answers?.accept;
    if (answer?.type !== "noul" || !Number.isFinite(answer.noul)) {
      throw new JevUnavailableError("Jev did not answer the draw offer.");
    }
    return {
      accept: answer.noul >= ACCEPT_THRESHOLD,
      probability: answer.noul,
      source: mode === "live" ? "jev" : "mock",
      model: result.model,
      latencyMs: now() - started,
    };
  } catch (error) {
    if (error instanceof APIUserAbortError || signal?.aborted) throw error;
    const reason = error instanceof JevUnavailableError ? error.message : describeFailure(error);
    log(`Jev draw fallback: ${reason} ${error instanceof Error ? `(${error.name}: ${error.message})` : ""}`);
    return {
      accept: fallbackAcceptsDraw(chess, jevColor, stockfishScore),
      source: "fallback",
      fallbackReason: reason,
      latencyMs: now() - started,
    };
  }
}
