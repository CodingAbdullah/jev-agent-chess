import { describe, expect, it } from "vitest";
import { aiColor, configFromSettings, modeLabel, pgnNames, playerNames } from "./game-config";
import { DEFAULT_SETTINGS } from "./settings";

describe("game config", () => {
  it("builds a two-player game", () => {
    const config = configFromSettings({ ...DEFAULT_SETTINGS, mode: "local" });
    expect(config).toEqual({ mode: "local" });
    expect(aiColor(config)).toBeNull();
    expect(playerNames(config)).toEqual({ w: "White", b: "Black" });
    expect(modeLabel(config)).toBe("2 Players");
  });

  it("builds a game against Jev", () => {
    const config = configFromSettings({ ...DEFAULT_SETTINGS, mode: "jev", jevColor: "b", personality: "tactical", difficulty: "hard" });
    expect(config).toEqual({ mode: "jev", humanColor: "b", personality: "tactical", difficulty: "hard" });
    expect(aiColor(config)).toBe("w");
    expect(playerNames(config)).toEqual({ w: "Jev", b: "You" });
    expect(pgnNames(config)).toEqual({ w: "Jev (Tactical, Hard)", b: "Player" });
  });

  it("picks a random colour when asked", () => {
    const settings = { ...DEFAULT_SETTINGS, mode: "jev" as const, jevColor: "random" as const };
    expect(configFromSettings(settings, () => 0.1)).toMatchObject({ humanColor: "w" });
    expect(configFromSettings(settings, () => 0.9)).toMatchObject({ humanColor: "b" });
  });
});
