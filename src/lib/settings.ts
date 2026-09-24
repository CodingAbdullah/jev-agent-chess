import { DEFAULT_BOARD_THEME_ID } from "./board-themes";
import { DEFAULT_TIME_CONTROL_ID } from "./chess/clock";
import { isDifficulty, isPersonality, type DifficultyId, type PersonalityId } from "./jev/types";

export type GameMode = "local" | "jev" | "stockfish" | "hybrid";

const GAME_MODES: readonly GameMode[] = ["local", "jev", "stockfish", "hybrid"];
export type ColorChoice = "w" | "b" | "random";

/** Per-device preferences. Light and dark mode are handled separately by next-themes. */
export type Settings = {
  boardTheme: string;
  sound: boolean;
  showCoordinates: boolean;
  timeControl: string;
  /** The last game setup chosen, so the new game dialog opens with it. */
  mode: GameMode;
  /** Your colour against Jev or Stockfish. */
  playerColor: ColorChoice;
  personality: PersonalityId;
  difficulty: DifficultyId;
  showEvaluation: boolean;
  /** Show the evaluation, and Stockfish's view of the position, while playing the computer. */
  evaluationInComputerGames: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  boardTheme: DEFAULT_BOARD_THEME_ID,
  sound: true,
  showCoordinates: true,
  timeControl: DEFAULT_TIME_CONTROL_ID,
  mode: "jev",
  playerColor: "w",
  personality: "balanced",
  difficulty: "medium",
  showEvaluation: true,
  evaluationInComputerGames: false,
};

const STORAGE_KEY = "jev-chess:settings";
const listeners = new Set<() => void>();

let cachedRaw: string | null | undefined;
let cachedSettings: Settings = DEFAULT_SETTINGS;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): Settings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    // `jevColor` is the older name for `playerColor`.
    const stored = JSON.parse(raw) as Partial<Settings> & { jevColor?: unknown };
    const color = stored.playerColor ?? stored.jevColor;
    return {
      boardTheme: typeof stored.boardTheme === "string" ? stored.boardTheme : DEFAULT_SETTINGS.boardTheme,
      sound: typeof stored.sound === "boolean" ? stored.sound : DEFAULT_SETTINGS.sound,
      showCoordinates:
        typeof stored.showCoordinates === "boolean" ? stored.showCoordinates : DEFAULT_SETTINGS.showCoordinates,
      timeControl: typeof stored.timeControl === "string" ? stored.timeControl : DEFAULT_SETTINGS.timeControl,
      mode: GAME_MODES.includes(stored.mode as GameMode) ? (stored.mode as GameMode) : DEFAULT_SETTINGS.mode,
      playerColor: color === "w" || color === "b" || color === "random" ? color : DEFAULT_SETTINGS.playerColor,
      personality: isPersonality(stored.personality) ? stored.personality : DEFAULT_SETTINGS.personality,
      difficulty: isDifficulty(stored.difficulty) ? stored.difficulty : DEFAULT_SETTINGS.difficulty,
      showEvaluation:
        typeof stored.showEvaluation === "boolean" ? stored.showEvaluation : DEFAULT_SETTINGS.showEvaluation,
      evaluationInComputerGames:
        typeof stored.evaluationInComputerGames === "boolean"
          ? stored.evaluationInComputerGames
          : DEFAULT_SETTINGS.evaluationInComputerGames,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Current settings. Returns the same object until storage changes, as useSyncExternalStore requires. */
export function getSettings(): Settings {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSettings = parse(raw);
  }
  return cachedSettings;
}

export const getServerSettings = (): Settings => DEFAULT_SETTINGS;

export function updateSettings(patch: Partial<Settings>): void {
  const next = { ...getSettings(), ...patch };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage can be unavailable, for example in private windows. Keep the change in memory.
    cachedRaw = JSON.stringify(next);
    cachedSettings = next;
  }
  listeners.forEach((listener) => listener());
}

export function subscribeToSettings(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
