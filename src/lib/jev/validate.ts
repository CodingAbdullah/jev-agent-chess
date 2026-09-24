import { Chess, validateFen } from "chess.js";
import { isDifficulty, isPersonality, type JevMoveRequest } from "./types";

export const MAX_BODY_BYTES = 16_000;
const MAX_HISTORY = 600;
const SAN_PATTERN = /^[a-hKQRBNO1-8x=+#\-]{2,8}$/;

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string; status: number };

/** Check an untrusted request body from the browser. */
export function parseMoveRequest(body: unknown): Parsed<JevMoveRequest> {
  const bad = (error: string, status = 400): Parsed<JevMoveRequest> => ({ ok: false, error, status });
  if (typeof body !== "object" || body === null) return bad("Expected a JSON object.");
  const { fen, history, personality, difficulty } = body as Record<string, unknown>;

  if (typeof fen !== "string" || !validateFen(fen).ok) return bad("fen must be a valid FEN string.");
  if (!Array.isArray(history) || history.length > MAX_HISTORY) {
    return bad(`history must be an array of at most ${MAX_HISTORY} moves.`);
  }
  if (!history.every((san) => typeof san === "string" && SAN_PATTERN.test(san))) {
    return bad("history must contain moves in SAN.");
  }
  if (!isPersonality(personality)) return bad("personality is not recognised.");
  if (!isDifficulty(difficulty)) return bad("difficulty is not recognised.");

  const chess = new Chess(fen);
  if (chess.isGameOver()) return bad("The game is already over.", 422);

  return { ok: true, value: { fen, history: history as string[], personality, difficulty } };
}
