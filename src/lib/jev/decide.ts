import {
  APIConnectionError,
  APIError,
  APITimeoutError,
  APIUserAbortError,
  AuthenticationError,
  PermissionDeniedError,
  RateLimitError,
} from "@typesafe-ai/sdk";
import { Chess, type Move } from "chess.js";
import { toMoveInput } from "@/lib/chess/game";
import type { JevClient, JevMode } from "./client";
import { bestByInterest } from "./heuristic";
import { buildMoveRequest, candidateMoves, type StockfishNote } from "./prompt";
import { selectMove, type Random } from "./select";
import type { JevMoveRequest, JevMoveResponse, MoveProbability, StockfishCandidate } from "./types";

/** How many of Jev's candidates the browser gets for its chart. */
export const ALTERNATIVES_SHOWN = 5;

class UnusableAnswerError extends Error {}

/** Plain-language reason for a failed Jev call, safe to show to players. */
export function describeFailure(error: unknown): string {
  if (error instanceof AuthenticationError) return "Jev rejected the API key.";
  if (error instanceof PermissionDeniedError) return "This API key is not allowed to use Jev.";
  if (error instanceof RateLimitError) return "Jev is rate limited right now.";
  if (error instanceof APITimeoutError) return "Jev did not answer in time.";
  if (error instanceof APIConnectionError) return "Jev could not be reached.";
  if (error instanceof APIError) return `Jev returned an error (HTTP ${error.status}).`;
  if (error instanceof UnusableAnswerError) return error.message;
  return "Jev returned an answer that could not be used.";
}

type DecideOptions = {
  client: JevClient;
  mode: JevMode;
  request: JevMoveRequest;
  signal?: AbortSignal;
  random?: Random;
  now?: () => number;
  log?: (message: string) => void;
};

/**
 * Match Stockfish's shortlist to legal moves, keeping its order. Anything that
 * is not legal here is dropped; the route has already checked there is at
 * least one legal candidate.
 */
export function hybridCandidates(chess: Chess, shortlist: readonly StockfishCandidate[]) {
  const byUci = new Map(
    chess.moves({ verbose: true }).map((move) => [`${move.from}${move.to}${move.promotion ?? ""}`, move]),
  );
  const moves: Move[] = [];
  const notes = new Map<string, StockfishNote>();
  for (const candidate of shortlist) {
    const move = byUci.get(candidate.uci);
    if (!move || notes.has(move.san)) continue;
    moves.push(move);
    notes.set(move.san, { rank: moves.length, score: candidate.score, line: candidate.line });
  }
  return { moves, notes };
}

/**
 * Ask Jev for a move. If Jev fails for any reason other than the caller
 * cancelling, a fallback plays instead and the response says why: Stockfish's
 * top choice in hybrid mode, or a simple local heuristic otherwise.
 */
export async function decideMove({
  client,
  mode,
  request,
  signal,
  random = Math.random,
  now = Date.now,
  log = (message) => console.warn(message),
}: DecideOptions): Promise<JevMoveResponse> {
  const started = now();
  const chess = new Chess(request.fen);
  const hybrid = request.candidates?.length ? hybridCandidates(chess, request.candidates) : null;
  const candidates = hybrid ? hybrid.moves : candidateMoves(chess);
  const bySan = new Map(candidates.map((move) => [move.san, move]));

  try {
    const result = await client.systemOne(
      buildMoveRequest(chess, request.history, request.personality, { candidates, stockfish: hybrid?.notes }),
      { signal },
    );
    const answer = result.answers?.move;
    if (!answer || answer.type !== "choice") {
      throw new UnusableAnswerError("Jev did not answer the move question.");
    }
    // Never trust a label we did not offer. chess.js has the final say.
    if (!bySan.has(answer.choice)) {
      throw new UnusableAnswerError("Jev chose a move that is not legal here.");
    }
    const ranked: MoveProbability[] = Object.entries(answer.probabilities ?? {})
      .filter(([san, probability]) => bySan.has(san) && Number.isFinite(probability))
      .map(([san, probability]) => ({ san, probability }))
      .sort((a, b) => b.probability - a.probability);
    if (ranked.length === 0) ranked.push({ san: answer.choice, probability: answer.confidence });

    const san = selectMove(ranked, request.difficulty, request.personality, random);
    return {
      move: toMoveInput(bySan.get(san)!),
      san,
      source: mode === "live" ? "jev" : "mock",
      topChoice: { san: answer.choice, probability: answer.probabilities?.[answer.choice] ?? answer.confidence },
      confidence: answer.confidence,
      alternatives: ranked.slice(0, ALTERNATIVES_SHOWN),
      model: result.model,
      latencyMs: now() - started,
    };
  } catch (error) {
    if (error instanceof APIUserAbortError || signal?.aborted) throw error;
    const reason = describeFailure(error);
    log(`Jev fallback: ${reason} ${error instanceof Error ? `(${error.name}: ${error.message})` : ""}`);
    const fallback = hybrid ? candidates[0] : bestByInterest(candidates);
    if (!fallback) throw new Error("No legal moves in this position");
    return {
      move: toMoveInput(fallback),
      san: fallback.san,
      source: "fallback",
      alternatives: [],
      fallbackReason: reason,
      latencyMs: now() - started,
    };
  }
}
