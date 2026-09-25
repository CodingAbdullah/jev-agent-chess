import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, getSettings, updateSettings } from "./settings";

describe("settings", () => {
  beforeEach(() => window.localStorage.clear());

  it("uses defaults when nothing is saved", () => {
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("reads the older jevColor name as playerColor", () => {
    window.localStorage.setItem("jev-chess:settings", JSON.stringify({ jevColor: "b" }));
    expect(getSettings().playerColor).toBe("b");
  });

  it("ignores unknown values", () => {
    window.localStorage.setItem("jev-chess:settings", JSON.stringify({ mode: "chaos", difficulty: 9, showEvaluation: "yes" }));
    expect(getSettings()).toMatchObject({ mode: "jev", difficulty: "medium", showEvaluation: true });
  });

  it("saves changes", () => {
    updateSettings({ mode: "stockfish", showEvaluation: false });
    expect(JSON.parse(window.localStorage.getItem("jev-chess:settings")!)).toMatchObject({
      mode: "stockfish",
      showEvaluation: false,
    });
  });
});
