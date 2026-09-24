"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { aiColor, type GameConfig } from "@/lib/game-config";
import { requestJevMove } from "@/lib/jev/api";
import type { JevMoveResponse } from "@/lib/jev/types";
import type { ChessGame, MoveOutcome } from "./use-chess-game";

/** Jev's moves arrive quickly. A short pause keeps them from feeling instant and jarring. */
export const MIN_THINK_MS = 500;

export type JevDecision = JevMoveResponse & { gameId: number; ply: number };

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

type Options = {
  config: GameConfig;
  game: ChessGame;
  onMove: (outcome: MoveOutcome) => void;
};

/**
 * Plays Jev's side. Whenever it is Jev's turn it asks the server for a move,
 * checks it with chess.js through the game, and plays it. Moving on (undo, new
 * game, a flag) cancels any request still in flight.
 */
export function useJevOpponent({ config, game, onMove }: Options) {
  const ai = aiColor(config);
  const aiTurn = ai !== null && !game.gameOver && game.chess.turn() === ai;
  const positionKey = `${game.gameId}:${game.revision}`;

  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [decisions, setDecisions] = useState<JevDecision[]>([]);
  const attemptKey = `${positionKey}:${attempt}`;

  const buildRequest = useEffectEvent(() => {
    if (config.mode !== "jev") throw new Error("Jev is not playing this game");
    return {
      fen: game.chess.fen(),
      history: game.history.map((move) => move.san),
      personality: config.personality,
      difficulty: config.difficulty,
    };
  });

  const play = useEffectEvent((decision: JevMoveResponse) => {
    const ply = game.history.length;
    const outcome = game.makeMove(decision.move);
    if (!outcome) {
      setFailure({ key: attemptKey, message: "Jev's move could not be played on this board." });
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
    requestJevMove(buildRequest(), controller.signal)
      .then(async (decision) => {
        await pause(MIN_THINK_MS - (Date.now() - started), controller.signal);
        if (!controller.signal.aborted) play(decision);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        fail(error instanceof Error ? error.message : "Jev could not be reached.");
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
    aiColor: ai,
    thinking: aiTurn && !error,
    error,
    lastDecision,
    retry: () => setAttempt((count) => count + 1),
  };
}
