/**
 * Types and options shared by the Jev route and the browser.
 * Nothing here may touch the API key or the SDK client.
 */
import type { MoveInput } from "@/lib/chess/game";
import type { Score } from "@/lib/stockfish/uci";

export const PERSONALITIES = [
  { id: "balanced", label: "Balanced", description: "Plays the move it judges strongest." },
  { id: "aggressive", label: "Aggressive", description: "Attacks the king and seeks initiative." },
  { id: "defensive", label: "Defensive", description: "Keeps the king safe and avoids risks." },
  { id: "positional", label: "Positional", description: "Improves pieces and structure slowly." },
  { id: "tactical", label: "Tactical", description: "Hunts for captures, forks and combinations." },
  { id: "unpredictable", label: "Unpredictable", description: "Mixes it up with surprising moves." },
] as const;

export type PersonalityId = (typeof PERSONALITIES)[number]["id"];

export const DIFFICULTIES = [
  { id: "easy", label: "Easy", description: "Often plays Jev's weaker ideas." },
  { id: "medium", label: "Medium", description: "Usually plays one of Jev's top ideas." },
  { id: "hard", label: "Hard", description: "Always plays Jev's top choice." },
] as const;

export type DifficultyId = (typeof DIFFICULTIES)[number]["id"];

export const isPersonality = (value: unknown): value is PersonalityId =>
  PERSONALITIES.some((option) => option.id === value);

export const isDifficulty = (value: unknown): value is DifficultyId =>
  DIFFICULTIES.some((option) => option.id === value);

export const personalityLabel = (id: PersonalityId) =>
  PERSONALITIES.find((option) => option.id === id)!.label;

export const difficultyLabel = (id: DifficultyId) =>
  DIFFICULTIES.find((option) => option.id === id)!.label;

/** A move Stockfish shortlisted for hybrid mode. */
export type StockfishCandidate = {
  /** The move in UCI notation, such as "e2e4". */
  uci: string;
  /** Stockfish's evaluation after this move, from White's side. */
  score: Score;
  /** The line Stockfish expects, in SAN, starting with this move. */
  line: string[];
};

/** What the browser sends to the Jev route. */
export type JevMoveRequest = {
  fen: string;
  /** Recent moves in SAN, oldest first, for context. */
  history: string[];
  personality: PersonalityId;
  difficulty: DifficultyId;
  /** Hybrid mode: Jev chooses only among these, best first. */
  candidates?: StockfishCandidate[];
};

export type MoveProbability = { san: string; probability: number };

/**
 * Where a move came from. "jev" is the live API, "mock" is the local stand-in
 * used when no API key is set, and "fallback" means Jev failed and a simple
 * local heuristic chose the move instead.
 */
export type JevSource = "jev" | "mock" | "fallback";

/** What the browser sends to ask for Jev's view of a position. */
export type JevEvaluateRequest = { fen: string; history: string[] };

/** Jev's judgment of a position, for the evaluation bar. */
export type JevEvaluation = {
  source: Exclude<JevSource, "fallback">;
  /** Jev's expected level, from 0 (Black is winning) to 6 (White is winning). */
  score: number;
  /** White's share of the evaluation bar, from 0 to 1. */
  whiteShare: number;
  /** The most likely level in words, such as "White is slightly better". */
  verdict: string;
  /** Jev's probability for that level, 0 to 1. */
  confidence: number;
  model?: string;
  latencyMs: number;
};

/** What the browser sends when the player offers Jev a draw. */
export type JevDrawRequest = {
  fen: string;
  history: string[];
  personality: PersonalityId;
  /** The side Jev plays. */
  jevColor: "w" | "b";
  /** Hybrid mode: Stockfish's evaluation of the position, from White's side. */
  stockfishScore?: Score;
};

/** Jev's answer to a draw offer. */
export type JevDrawResponse = {
  accept: boolean;
  source: JevSource;
  /** Jev's probability of accepting. Missing on fallback. */
  probability?: number;
  /** Why the fallback decided instead. */
  fallbackReason?: string;
  model?: string;
  latencyMs: number;
};

/** What the Jev route returns. */
export type JevMoveResponse = {
  move: MoveInput;
  san: string;
  source: JevSource;
  /** Jev's own top pick and its probability. Missing on fallback. */
  topChoice?: MoveProbability;
  /** Jev's reported confidence in its top pick, 0 to 1. Missing on fallback. */
  confidence?: number;
  /** Jev's leading candidates, most likely first. Empty on fallback. */
  alternatives: MoveProbability[];
  /** Why the fallback was used. */
  fallbackReason?: string;
  model?: string;
  latencyMs: number;
};
