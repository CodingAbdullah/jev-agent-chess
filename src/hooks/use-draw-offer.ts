"use client";

import type { Color } from "chess.js";
import { useEffect, useRef, useState } from "react";
import { askForDraw, type DrawAnswer } from "@/lib/draw-offer";
import { isAiGame, type GameConfig } from "@/lib/game-config";
import type { StockfishEngine } from "@/lib/stockfish/engine";
import type { ChessGame } from "./use-chess-game";

/**
 * A draw offer in the current position. `pending` waits for the other player
 * in a two-player game, `asking` waits for the computer, and `answered` holds
 * a refusal or an error.
 */
export type DrawOffer =
  | { state: "pending"; by: Color }
  | { state: "asking" }
  | { state: "answered"; message: string; failed?: boolean };

type Options = {
  config: GameConfig;
  game: ChessGame;
  names: Record<Color, string>;
  getEngine: () => StockfishEngine;
  /** Called with the computer's answer, so the screen can announce an accepted draw. */
  onAnswer?: (answer: DrawAnswer) => void;
};

/**
 * Draw offers. A player offers on their own turn, at most once per position:
 * any move, undo or new game withdraws the offer and cancels the computer's
 * thinking about it.
 */
export function useDrawOffer({ config, game, names, getEngine, onAnswer }: Options) {
  const positionKey = `${game.gameId}:${game.revision}`;
  const [offer, setOffer] = useState<{ key: string; offer: DrawOffer } | null>(null);
  const current = offer?.key === positionKey ? offer.offer : null;
  const controller = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      controller.current?.abort();
      controller.current = null;
    },
    [positionKey],
  );

  const set = (next: DrawOffer) => setOffer({ key: positionKey, offer: next });

  const offerDraw = () => {
    if (game.gameOver || (current && !(current.state === "answered" && current.failed))) return;
    const by = game.chess.turn();
    if (!isAiGame(config)) return set({ state: "pending", by });
    if (by !== config.humanColor) return;

    set({ state: "asking" });
    const request = new AbortController();
    controller.current = request;
    const key = positionKey;
    askForDraw({
      config,
      fen: game.chess.fen(),
      history: game.history.map((move) => move.san),
      getEngine,
      signal: request.signal,
    })
      .then((answer) => {
        if (request.signal.aborted) return;
        onAnswer?.(answer);
        if (answer.accept) game.agreeDraw();
        else setOffer({ key, offer: { state: "answered", message: answer.message } });
      })
      .catch((error: unknown) => {
        if (request.signal.aborted) return;
        const message = error instanceof Error ? error.message : "The draw offer could not be answered.";
        setOffer({ key, offer: { state: "answered", message, failed: true } });
      });
  };

  /** Two-player games: the other player accepts. */
  const accept = () => {
    if (current?.state === "pending") game.agreeDraw();
  };

  /** Two-player games: the other player declines. */
  const decline = () => {
    if (current?.state !== "pending") return;
    const other = current.by === "w" ? "b" : "w";
    set({ state: "answered", message: `${names[other]} declined the draw.` });
  };

  return {
    offer: current,
    /** Whether the side to move may offer a draw now. */
    canOffer:
      !game.gameOver &&
      (current === null || (current.state === "answered" && current.failed === true)) &&
      (!isAiGame(config) || game.chess.turn() === config.humanColor),
    offerDraw,
    accept,
    decline,
  };
}
