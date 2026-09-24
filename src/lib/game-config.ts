import type { Color } from "chess.js";
import { opponent } from "./chess/game";
import { personalityLabel, difficultyLabel, type DifficultyId, type PersonalityId } from "./jev/types";
import type { Settings } from "./settings";

/** Who is playing the current game. */
export type GameConfig =
  | { mode: "local" }
  | { mode: "jev"; humanColor: Color; personality: PersonalityId; difficulty: DifficultyId };

export function configFromSettings(settings: Settings, random: () => number = Math.random): GameConfig {
  if (settings.mode === "local") return { mode: "local" };
  const humanColor: Color =
    settings.jevColor === "random" ? (random() < 0.5 ? "w" : "b") : settings.jevColor;
  return { mode: "jev", humanColor, personality: settings.personality, difficulty: settings.difficulty };
}

/** The side Jev plays, or null in a two-player game. */
export function aiColor(config: GameConfig): Color | null {
  return config.mode === "jev" ? opponent(config.humanColor) : null;
}

export function playerNames(config: GameConfig): Record<Color, string> {
  if (config.mode === "local") return { w: "White", b: "Black" };
  const ai = opponent(config.humanColor);
  return { [config.humanColor]: "You", [ai]: "Jev" } as Record<Color, string>;
}

/** Player names for PGN headers, which should say which Jev setup played. */
export function pgnNames(config: GameConfig): Record<Color, string> {
  if (config.mode === "local") return { w: "White", b: "Black" };
  const jev = `Jev (${personalityLabel(config.personality)}, ${difficultyLabel(config.difficulty)})`;
  return { [config.humanColor]: "Player", [opponent(config.humanColor)]: jev } as Record<Color, string>;
}

export function modeLabel(config: GameConfig): string {
  return config.mode === "jev" ? "vs Jev" : "2 Players";
}
