import { describe, expect, it } from "vitest";
import { describeStatus, getStatus, replay, resultToken, statusTitle, toPgn, winnerOf, type MoveInput } from "./game";
import { createGameState, gameReducer, type GameState } from "./game-state";

const blitz = { initialMs: 60_000, incrementMs: 0 };
const e4: MoveInput = { from: "e2", to: "e4" };
const e5: MoveInput = { from: "e7", to: "e5" };
const play = (state: GameState, move: MoveInput, at: number) =>
  gameReducer(state, { type: "move", move, endsGame: false, at });

describe("resignation and agreed draws", () => {
  it("names the winner when a side resigns", () => {
    const status = getStatus(replay([e4]), null, { kind: "resignation", loser: "b" });
    expect(status).toEqual({ kind: "resignation", winner: "w" });
    expect(winnerOf(status)).toBe("w");
    expect(describeStatus(status)).toBe("Black resigned. White wins.");
    expect(describeStatus(status, { w: "You", b: "Jev" })).toBe("Jev resigned. You win.");
    expect(statusTitle(status)).toBe("Resignation");
    expect(resultToken(status)).toBe("1-0");
  });

  it("reports a draw by agreement", () => {
    const status = getStatus(replay([e4, e5]), null, { kind: "agreement" });
    expect(status).toEqual({ kind: "draw", reason: "agreement" });
    expect(winnerOf(status)).toBeNull();
    expect(describeStatus(status)).toBe("Draw by agreement.");
    expect(resultToken(status)).toBe("1/2-1/2");
    expect(toPgn({ moves: [e4, e5] }, status)).toContain('[Result "1/2-1/2"]');
  });

  it("lets checkmate on the board stand over a later ending", () => {
    const mated = replay([
      { from: "f2", to: "f3" },
      { from: "e7", to: "e5" },
      { from: "g2", to: "g4" },
      { from: "d8", to: "h4" },
    ]);
    expect(getStatus(mated, null, { kind: "resignation", loser: "b" })).toEqual({ kind: "checkmate", winner: "b" });
  });
});

describe("gameReducer endings", () => {
  it("stops the clock when a player resigns, and refuses further moves", () => {
    let state = play(createGameState(blitz), e4, 1_000);
    state = gameReducer(state, { type: "resign", color: "b", at: 4_000 });
    expect(state.ending).toEqual({ kind: "resignation", loser: "b" });
    expect(state.clock).toEqual({ remaining: { w: 60_000, b: 57_000 }, runningSince: null });
    expect(play(state, e5, 5_000)).toBe(state);
    expect(gameReducer(state, { type: "flag", color: "b", at: 99_000 })).toBe(state);
  });

  it("records an agreed draw once", () => {
    let state = play(createGameState(null), e4, 0);
    state = gameReducer(state, { type: "agree-draw", at: 1 });
    expect(state.ending).toEqual({ kind: "agreement" });
    expect(gameReducer(state, { type: "resign", color: "w", at: 2 })).toBe(state);
  });

  it("undo takes the ending back along with the last move", () => {
    let state = play(play(createGameState(null), e4, 0), e5, 1);
    state = gameReducer(state, { type: "resign", color: "w", at: 2 });
    state = gameReducer(state, { type: "undo", at: 3 });
    expect(state.ending).toBeNull();
    expect(state.plies).toHaveLength(1);
  });

  it("starts each new game without an ending", () => {
    const state = gameReducer(gameReducer(createGameState(null), { type: "agree-draw", at: 0 }), {
      type: "new",
      timeControl: null,
    });
    expect(state.ending).toBeNull();
  });
});
