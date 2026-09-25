import type { Color } from "chess.js";
import {
  clockAfterMove,
  initialClock,
  stopClock,
  type ClockState,
  type TimeControl,
} from "./clock";
import { opponent, type GameEnding, type LoadedGame, type MoveInput } from "./game";

/** One half-move and the clock right after it, so undo can restore the clock. */
export type Ply = { move: MoveInput; clockAfter: ClockState | null };

export type GameState = {
  startFen?: string;
  /** Who moves first from `startFen`. */
  firstToMove: Color;
  plies: Ply[];
  timeControl: TimeControl | null;
  clockAtStart: ClockState | null;
  clock: ClockState | null;
  /** The side whose clock ran out, if any. */
  flagged: Color | null;
  /** A resignation or an agreed draw, if the players ended the game. */
  ending: GameEnding | null;
  /** Increments on every change, so views can tell one game end from another. */
  revision: number;
  /** Increments when a new game starts or one is loaded. */
  gameId: number;
};

export type GameAction =
  | { type: "move"; move: MoveInput; endsGame: boolean; at: number }
  | { type: "undo"; at: number }
  | { type: "flag"; color: Color; at: number }
  | { type: "resign"; color: Color; at: number }
  | { type: "agree-draw"; at: number }
  | { type: "new"; timeControl: TimeControl | null }
  | { type: "load"; game: LoadedGame; firstToMove: Color; timeControl: TimeControl | null };

export function createGameState(
  timeControl: TimeControl | null,
  game: LoadedGame = { moves: [] },
  firstToMove: Color = "w",
  gameId = 0,
): GameState {
  const clock = initialClock(timeControl);
  return {
    startFen: game.startFen,
    firstToMove,
    // Loaded moves carry no clock history, so undo returns to the fresh clock.
    plies: game.moves.map((move) => ({ move, clockAfter: clock })),
    timeControl,
    clockAtStart: clock,
    clock,
    flagged: null,
    ending: null,
    revision: 0,
    gameId,
  };
}

/** Whose turn it is after the given number of plies. */
export function sideToMove(state: Pick<GameState, "firstToMove" | "plies">): Color {
  return state.plies.length % 2 === 0 ? state.firstToMove : opponent(state.firstToMove);
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "move": {
      if (state.flagged || state.ending) return state;
      const mover = sideToMove(state);
      let clock =
        state.clock && state.timeControl
          ? clockAfterMove(state.clock, mover, action.at, state.timeControl)
          : null;
      if (clock && action.endsGame) clock = { ...clock, runningSince: null };
      return {
        ...state,
        plies: [...state.plies, { move: action.move, clockAfter: clock }],
        clock,
        revision: state.revision + 1,
      };
    }

    case "undo": {
      if (state.plies.length === 0) return state;
      const plies = state.plies.slice(0, -1);
      const restored = plies.at(-1)?.clockAfter ?? state.clockAtStart;
      // The clock resumes for the side to move, unless we are back at the start.
      const clock = restored
        ? { ...restored, runningSince: plies.length > 0 ? action.at : null }
        : null;
      return { ...state, plies, clock, flagged: null, ending: null, revision: state.revision + 1 };
    }

    case "resign":
    case "agree-draw": {
      if (state.flagged || state.ending) return state;
      const ending: GameEnding =
        action.type === "resign" ? { kind: "resignation", loser: action.color } : { kind: "agreement" };
      const clock = state.clock ? stopClock(state.clock, sideToMove(state), action.at) : null;
      return { ...state, ending, clock, revision: state.revision + 1 };
    }

    case "flag": {
      if (state.flagged || state.ending || !state.clock) return state;
      const stopped = stopClock(state.clock, action.color, action.at);
      return {
        ...state,
        clock: { ...stopped, remaining: { ...stopped.remaining, [action.color]: 0 } },
        flagged: action.color,
        revision: state.revision + 1,
      };
    }

    case "new":
      return createGameState(action.timeControl, { moves: [] }, "w", state.gameId + 1);

    case "load":
      return createGameState(action.timeControl, action.game, action.firstToMove, state.gameId + 1);
  }
}
