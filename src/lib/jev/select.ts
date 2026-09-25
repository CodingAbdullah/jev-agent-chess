import type { DifficultyId, MoveProbability, PersonalityId } from "./types";

export type Random = () => number;

/**
 * How difficulty turns Jev's probabilities into the move played.
 * `topK` limits sampling to Jev's best ideas, and `temperature` flattens
 * (above 1) or sharpens (below 1) the probabilities before sampling.
 */
const SAMPLING: Record<DifficultyId, { topK: number; temperature: number }> = {
  hard: { topK: 1, temperature: 1 },
  medium: { topK: 3, temperature: 0.6 },
  easy: { topK: 8, temperature: 1.6 },
};

/**
 * Pick the move to play from Jev's candidates, sorted most likely first.
 * Hard always takes the top choice, except for the unpredictable personality,
 * which always samples.
 */
export function selectMove(
  candidates: readonly MoveProbability[],
  difficulty: DifficultyId,
  personality: PersonalityId,
  random: Random = Math.random,
): string {
  if (candidates.length === 0) throw new Error("No candidate moves to choose from");
  let { topK, temperature } = SAMPLING[difficulty];
  if (personality === "unpredictable") {
    topK = Math.max(topK, 4);
    temperature *= 1.5;
  }
  const pool = candidates.slice(0, topK);
  if (pool.length === 1) return pool[0]!.san;

  const weights = pool.map((candidate) => Math.max(candidate.probability, 1e-6) ** (1 / temperature));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = random() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]!;
    if (roll < 0) return pool[i]!.san;
  }
  return pool.at(-1)!.san;
}
