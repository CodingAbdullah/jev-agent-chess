"use client";

import { Chess, type Color } from "chess.js";
import { useCallback, useEffect, useMemo, useReducer } from "react";
import { timeLeft, type TimeControl } from "@/lib/chess/clock";
import {
  capturedPieces,
  getStatus,
  isGameOver,
  materialBalance,
  replay,
  toMoveInput,
  tryMove,
  type LoadedGame,
  type Move,
  type MoveInput,
} from "@/lib/chess/game";
import { createGameState, gameReducer } from "@/lib/chess/game-state";

export type MoveOutcome = { move: Move };

/**
 * Local game state. The reducer's move list is the single source of truth, and
 * the chess.js instance is rebuilt from it. Treat the returned `chess` as read-only.
 */
export function useChessGame(initialTimeControl: TimeControl | null) {
  const [state, dispatch] = useReducer(gameReducer, initialTimeControl, createGameState);

  const moves = useMemo(() => state.plies.map((ply) => ply.move), [state.plies]);
  const chess = useMemo(() => replay(moves, state.startFen), [moves, state.startFen]);
  const history = useMemo(() => chess.history({ verbose: true }), [chess]);
  const status = useMemo(() => getStatus(chess, state.flagged, state.ending), [chess, state.flagged, state.ending]);
  const captured = useMemo(() => capturedPieces(history), [history]);
  const material = useMemo(() => materialBalance(chess), [chess]);
  const gameOver = isGameOver(status);
  const { clock } = state;

  // Flag the side to move at the exact moment its clock reaches zero.
  useEffect(() => {
    if (!clock || clock.runningSince === null || gameOver) return;
    const turn = chess.turn();
    const remaining = timeLeft(clock, turn, turn, Date.now());
    const timer = setTimeout(
      () => dispatch({ type: "flag", color: turn, at: Date.now() }),
      remaining,
    );
    return () => clearTimeout(timer);
  }, [clock, chess, gameOver]);

  const makeMove = useCallback(
    (input: MoveInput): MoveOutcome | null => {
      if (gameOver) return null;
      const now = Date.now();
      const mover = chess.turn();
      if (clock && timeLeft(clock, mover, mover, now) <= 0) {
        dispatch({ type: "flag", color: mover, at: now });
        return null;
      }
      // Replay rather than copy the FEN, so repetition counts carry over.
      const next = replay(moves, state.startFen);
      const move = tryMove(next, input);
      if (!move) return null;
      dispatch({ type: "move", move: toMoveInput(move), endsGame: next.isGameOver(), at: now });
      return { move };
    },
    [chess, clock, gameOver, moves, state.startFen],
  );

  const undo = useCallback(() => dispatch({ type: "undo", at: Date.now() }), []);

  const resign = useCallback((color: Color) => dispatch({ type: "resign", color, at: Date.now() }), []);

  const agreeDraw = useCallback(() => dispatch({ type: "agree-draw", at: Date.now() }), []);

  const newGame = useCallback(
    (timeControl: TimeControl | null) => dispatch({ type: "new", timeControl }),
    [],
  );

  const loadGame = useCallback((game: LoadedGame, timeControl: TimeControl | null) => {
    const firstToMove = new Chess(game.startFen).turn();
    dispatch({ type: "load", game, firstToMove, timeControl });
  }, []);

  return {
    chess,
    history,
    status,
    gameOver,
    captured,
    material,
    clock,
    timeControl: state.timeControl,
    startFen: state.startFen,
    moves,
    revision: state.revision,
    gameId: state.gameId,
    canUndo: moves.length > 0,
    makeMove,
    undo,
    resign,
    agreeDraw,
    newGame,
    loadGame,
  };
}

export type ChessGame = ReturnType<typeof useChessGame>;
