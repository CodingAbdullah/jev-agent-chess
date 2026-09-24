"use client";

import type { Color } from "chess.js";
import { useEffect, useEffectEvent, useState } from "react";
import type { MoveInput } from "@/lib/chess/game";
import type { ChessGame, MoveOutcome } from "./use-chess-game";

/** Computer moves can arrive very quickly. A short pause keeps them from feeling jarring. */
export const MIN_THINK_MS = 500;

/** What a computer player must return: the move, plus any details its panel shows. */
export type AiMove = { move: MoveInput; san: string };

export type AiDecision<D extends AiMove> = D & { gameId: number; ply: number };

/** Ask the computer for a move in this position. Must reject if `signal` fires. */
export type Think<D extends AiMove> = (
  position: { fen: string; history: string[] },
  signal: AbortSignal,
) => Promise<D>;

function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (ms <= 0 || signal.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

type Options<D extends AiMove> = {
  /** The side the computer plays, or null when nobody does. */
  color: Color | null;
  game: ChessGame;
  think: Think<D>;
  onMove: (outcome: MoveOutcome) => void;
};

/**
 * Plays the computer's side. Whenever it is the computer's turn it asks
 * `think` for a move, plays it through the game (where chess.js checks it),
 * and records the decision for the panel. Undo, a new game or a flag cancels
 * any thinking still in progress.
 */
export function useAiOpponent<D extends AiMove>({ color, game, think, onMove }: Options<D>) {
  const aiTurn = color !== null && !game.gameOver && game.chess.turn() === color;
  const positionKey = `${game.gameId}:${game.revision}`;

  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [decisions, setDecisions] = useState<AiDecision<D>[]>([]);
  const attemptKey = `${positionKey}:${attempt}`;

  const ask = useEffectEvent((signal: AbortSignal) =>
    think({ fen: game.chess.fen(), history: game.history.map((move) => move.san) }, signal),
  );

  const play = useEffectEvent((decision: D) => {
    const ply = game.history.length;
    const outcome = game.makeMove(decision.move);
    if (!outcome) {
      setFailure({ key: attemptKey, message: "The computer's move could not be played on this board." });
      return;
    }
    setDecisions((list) => [
      ...list.filter((entry) => entry.gameId === game.gameId && entry.ply < ply),
      { ...decision, gameId: game.gameId, ply },
    ]);
    onMove(outcome);
  });

  const fail = useEffectEvent((message: string) => setFailure({ key: attemptKey, message }));

  useEffect(() => {
    if (!aiTurn) return;
    const controller = new AbortController();
    const started = Date.now();
    ask(controller.signal)
      .then(async (decision) => {
        await pause(MIN_THINK_MS - (Date.now() - started), controller.signal);
        if (!controller.signal.aborted) play(decision);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        fail(error instanceof Error ? error.message : "The computer could not choose a move.");
      });
    return () => controller.abort();
  }, [aiTurn, attemptKey]);

  const error = aiTurn && failure?.key === attemptKey ? failure.message : null;

  // Show the latest decision whose move is still on the board, so undo hides it.
  const lastDecision =
    decisions.findLast(
      (entry) => entry.gameId === game.gameId && game.history[entry.ply]?.san === entry.san,
    ) ?? null;

  return {
    thinking: aiTurn && !error,
    error,
    lastDecision,
    retry: () => setAttempt((count) => count + 1),
  };
}
