import type { Color } from "chess.js";
import { opponent } from "./chess/game";
import { difficultyLabel, personalityLabel, type DifficultyId, type PersonalityId } from "./jev/types";
import type { Settings } from "./settings";

/** Who is playing the current game. */
export type GameConfig =
  | { mode: "local" }
  | { mode: "jev"; humanColor: Color; personality: PersonalityId; difficulty: DifficultyId }
  | { mode: "stockfish"; humanColor: Color; difficulty: DifficultyId };

export type AiConfig = Exclude<GameConfig, { mode: "local" }>;

export function configFromSettings(settings: Settings, random: () => number = Math.random): GameConfig {
  if (settings.mode === "local") return { mode: "local" };
  const humanColor: Color =
    settings.playerColor === "random" ? (random() < 0.5 ? "w" : "b") : settings.playerColor;
  if (settings.mode === "stockfish") return { mode: "stockfish", humanColor, difficulty: settings.difficulty };
  return { mode: "jev", humanColor, personality: settings.personality, difficulty: settings.difficulty };
}

export const isAiGame = (config: GameConfig): config is AiConfig => config.mode !== "local";

/** The side the computer plays, or null in a two-player game. */
export function aiColor(config: GameConfig): Color | null {
  return isAiGame(config) ? opponent(config.humanColor) : null;
}

export const aiName = (config: AiConfig) => (config.mode === "jev" ? "Jev" : "Stockfish");

export function playerNames(config: GameConfig): Record<Color, string> {
  if (!isAiGame(config)) return { w: "White", b: "Black" };
  return { [config.humanColor]: "You", [opponent(config.humanColor)]: aiName(config) } as Record<Color, string>;
}

/** A short description of the computer's setup, such as "Aggressive, Hard". */
export function aiSetupLabel(config: AiConfig): string {
  return config.mode === "jev"
    ? `${personalityLabel(config.personality)}, ${difficultyLabel(config.difficulty)}`
    : difficultyLabel(config.difficulty);
}

/** Player names for PGN headers, which should say which computer setup played. */
export function pgnNames(config: GameConfig): Record<Color, string> {
  if (!isAiGame(config)) return { w: "White", b: "Black" };
  const computer = `${aiName(config)} (${aiSetupLabel(config)})`;
  return { [config.humanColor]: "Player", [opponent(config.humanColor)]: computer } as Record<Color, string>;
}

export function modeLabel(config: GameConfig): string {
  return isAiGame(config) ? `vs ${aiName(config)}` : "2 Players";
}
