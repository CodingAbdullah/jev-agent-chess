"use client";

import { Chess } from "chess.js";
import { useCallback, useMemo, useState } from "react";
import {
  getStatus,
  replay,
  tryMove,
  type Move,
  type MoveInput,
  type PromotionPiece,
} from "@/lib/chess/game";

/**
 * Local game state. The move list is the single source of truth, and the
 * chess.js instance is rebuilt from it, so undo and replay stay trivial later.
 * Treat the returned `chess` as read-only.
 */
export function useChessGame() {
  const [moves, setMoves] = useState<readonly MoveInput[]>([]);

  const chess = useMemo(() => replay(moves), [moves]);
  const status = useMemo(() => getStatus(chess), [chess]);
  const lastMove = useMemo<Move | null>(
    () => chess.history({ verbose: true }).at(-1) ?? null,
    [chess],
  );

  const makeMove = useCallback(
    (input: MoveInput): boolean => {
      if (status.kind !== "playing") return false;
      const move = tryMove(new Chess(chess.fen()), input);
      if (!move) return false;
      const played: MoveInput = { from: move.from, to: move.to };
      if (move.promotion) played.promotion = move.promotion as PromotionPiece;
      setMoves([...moves, played]);
      return true;
    },
    [chess, moves, status.kind],
  );

  const reset = useCallback(() => setMoves([]), []);

  return { chess, status, lastMove, moveCount: moves.length, makeMove, reset };
}
