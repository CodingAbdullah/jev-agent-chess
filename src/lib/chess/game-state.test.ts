import { describe, expect, it } from "vitest";
import { createGameState, gameReducer, sideToMove, type GameState } from "./game-state";
import type { MoveInput } from "./game";

const blitz = { initialMs: 60_000, incrementMs: 1_000 };
const e4: MoveInput = { from: "e2", to: "e4" };
const e5: MoveInput = { from: "e7", to: "e5" };
const nf3: MoveInput = { from: "g1", to: "f3" };

const play = (state: GameState, move: MoveInput, at: number, endsGame = false) =>
  gameReducer(state, { type: "move", move, endsGame, at });

describe("gameReducer", () => {
  it("starts the opponent's clock after the first move", () => {
    const state = play(createGameState(blitz), e4, 1_000);
    expect(state.plies).toHaveLength(1);
    expect(state.clock).toEqual({ remaining: { w: 60_000, b: 60_000 }, runningSince: 1_000 });
    expect(sideToMove(state)).toBe("b");
  });

  it("charges time and adds increment on later moves", () => {
    let state = play(createGameState(blitz), e4, 1_000);
    state = play(state, e5, 6_000);
    expect(state.clock).toEqual({ remaining: { w: 60_000, b: 56_000 }, runningSince: 6_000 });
  });

  it("stops the clock when a move ends the game", () => {
    let state = play(createGameState(blitz), e4, 1_000);
    state = play(state, e5, 3_000, true);
    expect(state.clock?.runningSince).toBeNull();
  });

  it("plays without a clock in unlimited games", () => {
    const state = play(createGameState(null), e4, 1_000);
    expect(state.clock).toBeNull();
    expect(state.plies[0]?.clockAfter).toBeNull();
  });

  it("undoes the last move and restores the clock from before it", () => {
    let state = play(createGameState(blitz), e4, 1_000);
    state = play(state, e5, 6_000);
    state = play(state, nf3, 20_000);
    state = gameReducer(state, { type: "undo", at: 30_000 });
    expect(state.plies.map((p) => p.move)).toEqual([e4, e5]);
    // White's clock resumes from the value after Black's move, starting now.
    expect(state.clock).toEqual({ remaining: { w: 60_000, b: 56_000 }, runningSince: 30_000 });
  });

  it("stops the clock when undoing back to the start", () => {
    let state = play(createGameState(blitz), e4, 1_000);
    state = gameReducer(state, { type: "undo", at: 5_000 });
    expect(state.plies).toHaveLength(0);
    expect(state.clock).toEqual({ remaining: { w: 60_000, b: 60_000 }, runningSince: null });
  });

  it("ignores undo with no moves", () => {
    const state = createGameState(blitz);
    expect(gameReducer(state, { type: "undo", at: 1 })).toBe(state);
  });

  it("records a flag, zeroes that clock and blocks further moves", () => {
    let state = play(createGameState(blitz), e4, 0);
    state = gameReducer(state, { type: "flag", color: "b", at: 60_000 });
    expect(state.flagged).toBe("b");
    expect(state.clock).toEqual({ remaining: { w: 60_000, b: 0 }, runningSince: null });
    expect(play(state, e5, 61_000)).toBe(state);
  });

  it("clears the flag on undo", () => {
    let state = play(createGameState(blitz), e4, 0);
    state = play(state, e5, 1_000);
    state = gameReducer(state, { type: "flag", color: "w", at: 70_000 });
    state = gameReducer(state, { type: "undo", at: 80_000 });
    expect(state.flagged).toBeNull();
    expect(state.plies).toHaveLength(1);
  });

  it("starts a new game with a new id and time control", () => {
    let state = play(createGameState(blitz), e4, 0);
    state = gameReducer(state, { type: "new", timeControl: null });
    expect(state.plies).toHaveLength(0);
    expect(state.clock).toBeNull();
    expect(state.gameId).toBe(1);
  });

  it("loads a game from a position with Black to move", () => {
    const state = gameReducer(createGameState(blitz), {
      type: "load",
      game: { startFen: "4k3/8/8/8/8/8/4P3/4K3 b - - 0 1", moves: [{ from: "e8", to: "d7" }] },
      firstToMove: "b",
      timeControl: blitz,
    });
    expect(state.startFen).toBe("4k3/8/8/8/8/8/4P3/4K3 b - - 0 1");
    expect(sideToMove(state)).toBe("w");
    expect(state.clock?.runningSince).toBeNull();
  });

  it("bumps the revision on every change", () => {
    let state = createGameState(blitz);
    state = play(state, e4, 0);
    state = gameReducer(state, { type: "undo", at: 1 });
    expect(state.revision).toBe(2);
  });
});
