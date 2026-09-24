import { describe, expect, it } from "vitest";
import {
  clockAfterMove,
  findTimeControl,
  formatClock,
  initialClock,
  stopClock,
  timeLeft,
  type ClockState,
} from "./clock";

const blitz = { initialMs: 180_000, incrementMs: 2_000 };

describe("initialClock", () => {
  it("gives both sides the starting time, not yet running", () => {
    expect(initialClock(blitz)).toEqual({
      remaining: { w: 180_000, b: 180_000 },
      runningSince: null,
    });
  });

  it("has no clock for unlimited games", () => {
    expect(initialClock(null)).toBeNull();
  });
});

describe("timeLeft", () => {
  const running: ClockState = { remaining: { w: 60_000, b: 30_000 }, runningSince: 1_000 };

  it("counts down only for the side to move", () => {
    expect(timeLeft(running, "w", "w", 11_000)).toBe(50_000);
    expect(timeLeft(running, "b", "w", 11_000)).toBe(30_000);
  });

  it("never goes below zero", () => {
    expect(timeLeft(running, "w", "w", 999_999)).toBe(0);
  });

  it("does not count down while stopped", () => {
    expect(timeLeft({ ...running, runningSince: null }, "w", "w", 50_000)).toBe(60_000);
  });
});

describe("clockAfterMove", () => {
  it("makes the first move free and starts the clock", () => {
    const clock = clockAfterMove(initialClock(blitz)!, "w", 5_000, blitz);
    expect(clock).toEqual({ remaining: { w: 180_000, b: 180_000 }, runningSince: 5_000 });
  });

  it("charges the mover and adds the increment", () => {
    const started: ClockState = { remaining: { w: 180_000, b: 180_000 }, runningSince: 5_000 };
    const clock = clockAfterMove(started, "b", 15_000, blitz);
    expect(clock).toEqual({ remaining: { w: 180_000, b: 172_000 }, runningSince: 15_000 });
  });
});

describe("stopClock", () => {
  it("freezes the side to move at its current time", () => {
    const started: ClockState = { remaining: { w: 60_000, b: 60_000 }, runningSince: 0 };
    expect(stopClock(started, "b", 4_000)).toEqual({
      remaining: { w: 60_000, b: 56_000 },
      runningSince: null,
    });
  });
});

describe("formatClock", () => {
  it.each([
    [600_000, "10:00"],
    [65_000, "1:05"],
    [10_000, "0:10"],
    [9_950, "0:09.9"],
    [300, "0:00.3"],
    [0, "0:00.0"],
    [-5, "0:00.0"],
    [3_600_000, "1:00:00"],
    [59_001, "1:00"],
  ])("formats %i ms as %s", (ms, text) => {
    expect(formatClock(ms)).toBe(text);
  });
});

describe("findTimeControl", () => {
  it("finds a control by id and falls back to the default", () => {
    expect(findTimeControl("3+2").control).toEqual(blitz);
    expect(findTimeControl("nope").id).toBe("10+0");
  });
});
