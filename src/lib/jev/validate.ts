import { Chess, validateFen } from "chess.js";
import type { Score } from "@/lib/stockfish/uci";
import {
  isDifficulty,
  isPersonality,
  type JevDrawRequest,
  type JevEvaluateRequest,
  type JevMoveRequest,
  type StockfishCandidate,
} from "./types";

export const MAX_BODY_BYTES = 16_000;
const MAX_HISTORY = 600;
const SAN_PATTERN = /^[a-hKQRBNO1-8x=+#\-]{2,8}$/;

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string; status: number };

const bad = <T>(error: string, status = 400): Parsed<T> => ({ ok: false, error, status });

type Position = { fields: Record<string, unknown>; fen: string; history: string[]; chess: Chess };

/** The fields every Jev request shares: a position still in play, and the moves that led to it. */
function parsePosition(body: unknown): Parsed<Position> {
  if (typeof body !== "object" || body === null) return bad("Expected a JSON object.");
  const fields = body as Record<string, unknown>;
  const { fen, history } = fields;
  if (typeof fen !== "string" || !validateFen(fen).ok) return bad("fen must be a valid FEN string.");
  if (!Array.isArray(history) || history.length > MAX_HISTORY) {
    return bad(`history must be an array of at most ${MAX_HISTORY} moves.`);
  }
  if (!history.every((san) => typeof san === "string" && SAN_PATTERN.test(san))) {
    return bad("history must contain moves in SAN.");
  }
  const chess = new Chess(fen);
  if (chess.isGameOver()) return bad("The game is already over.", 422);
  return { ok: true, value: { fields, fen, history: history as string[], chess } };
}

/** Check an untrusted request for Jev's view of a position. */
export function parseEvaluateRequest(body: unknown): Parsed<JevEvaluateRequest> {
  const position = parsePosition(body);
  if (!position.ok) return position;
  return { ok: true, value: { fen: position.value.fen, history: position.value.history } };
}

/** Check an untrusted draw offer to Jev. */
export function parseDrawRequest(body: unknown): Parsed<JevDrawRequest> {
  const position = parsePosition(body);
  if (!position.ok) return position;
  const { fields, fen, history, chess } = position.value;
  const { personality, jevColor, stockfishScore } = fields;
  if (!isPersonality(personality)) return bad("personality is not recognised.");
  if (jevColor !== "w" && jevColor !== "b") return bad('jevColor must be "w" or "b".');
  // Draws are offered on your own turn, so Jev is waiting for your move.
  if (chess.turn() === jevColor) return bad("Offer a draw on your own turn.", 422);
  const value: JevDrawRequest = { fen, history, personality, jevColor };
  if (stockfishScore !== undefined) {
    if (!isScore(stockfishScore)) return bad("stockfishScore must be a score in centipawns or moves to mate.");
    value.stockfishScore = { type: stockfishScore.type, value: stockfishScore.value };
  }
  return { ok: true, value };
}

/** Check an untrusted request body from the browser. */
export function parseMoveRequest(body: unknown): Parsed<JevMoveRequest> {
  const position = parsePosition(body);
  if (!position.ok) return position;
  const { fields, fen, history, chess } = position.value;
  const { personality, difficulty } = fields;
  if (!isPersonality(personality)) return bad("personality is not recognised.");
  if (!isDifficulty(difficulty)) return bad("difficulty is not recognised.");

  const value: JevMoveRequest = { fen, history, personality, difficulty };
  const { candidates } = fields;
  if (candidates !== undefined) {
    const parsed = parseCandidates(candidates, chess);
    if (typeof parsed === "string") return bad<JevMoveRequest>(parsed);
    value.candidates = parsed;
  }
  return { ok: true, value };
}

const MAX_CANDIDATES = 8;
const MAX_LINE = 10;
const UCI_PATTERN = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

function isScore(value: unknown): value is Score {
  if (typeof value !== "object" || value === null) return false;
  const { type, value: amount } = value as Record<string, unknown>;
  return (
    (type === "cp" || type === "mate") &&
    typeof amount === "number" &&
    Number.isInteger(amount) &&
    Math.abs(amount) <= 100_000
  );
}

/** Check Stockfish's shortlist from the browser. Returns an error message or the candidates. */
function parseCandidates(input: unknown, chess: Chess): StockfishCandidate[] | string {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_CANDIDATES) {
    return `candidates must be an array of 1 to ${MAX_CANDIDATES} moves.`;
  }
  const legal = new Set(chess.moves({ verbose: true }).map((move) => `${move.from}${move.to}${move.promotion ?? ""}`));
  const candidates: StockfishCandidate[] = [];
  for (const item of input) {
    if (typeof item !== "object" || item === null) return "Each candidate must be an object.";
    const { uci, score, line } = item as Record<string, unknown>;
    if (typeof uci !== "string" || !UCI_PATTERN.test(uci)) return "Each candidate needs a move in UCI notation.";
    if (!isScore(score)) return "Each candidate needs a score in centipawns or moves to mate.";
    if (
      !Array.isArray(line) ||
      line.length > MAX_LINE ||
      !line.every((san) => typeof san === "string" && SAN_PATTERN.test(san))
    ) {
      return `Each candidate's line must be at most ${MAX_LINE} moves in SAN.`;
    }
    candidates.push({ uci, score: { type: score.type, value: score.value }, line: line as string[] });
  }
  if (!candidates.some((candidate) => legal.has(candidate.uci))) {
    return "None of the candidates is a legal move in this position.";
  }
  return candidates;
}
