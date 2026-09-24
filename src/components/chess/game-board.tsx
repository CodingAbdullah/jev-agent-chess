"use client";

import type { Chess } from "chess.js";
import { useCallback, useMemo, useState, type CSSProperties } from "react";
import {
  Chessboard,
  type PieceDropHandlerArgs,
  type PieceHandlerArgs,
  type SquareHandlerArgs,
} from "react-chessboard";
import {
  isOwnPiece,
  isSquare,
  kingSquare,
  legalMovesFrom,
  needsPromotion,
  type Move,
  type MoveInput,
  type PromotionPiece,
  type Square,
} from "@/lib/chess/game";
import { PromotionPicker } from "./promotion-picker";

const LAST_MOVE_TINT = "rgba(255, 213, 0, 0.35)";
const SELECTED_TINT = "rgba(255, 213, 0, 0.55)";
const MOVE_DOT = "radial-gradient(circle, rgba(0, 0, 0, 0.22) 22%, transparent 23%)";
const CAPTURE_RING =
  "radial-gradient(circle, transparent 60%, rgba(0, 0, 0, 0.22) 61%)";
const CHECK_GLOW =
  "radial-gradient(circle, rgba(220, 38, 38, 0.9) 0%, rgba(220, 38, 38, 0.45) 45%, transparent 72%)";

type GameBoardProps = {
  /** The current game. Read-only: the board never mutates it. */
  chess: Chess;
  lastMove: Move | null;
  /** When false, pieces cannot be selected or dragged. */
  interactive: boolean;
  orientation?: "white" | "black";
  /** Returns true when the move was accepted. */
  onMove: (move: MoveInput) => boolean;
};

/** Selection and pending promotion are tagged with the position they belong to, so they reset on any move. */
type Tagged<T> = { fen: string; value: T };

export function GameBoard({
  chess,
  lastMove,
  interactive,
  orientation = "white",
  onMove,
}: GameBoardProps) {
  const fen = chess.fen();
  const [selection, setSelection] = useState<Tagged<Square> | null>(null);
  const [promotion, setPromotion] = useState<Tagged<{ from: Square; to: Square }> | null>(
    null,
  );

  const selected = interactive && selection?.fen === fen ? selection.value : null;
  const pendingPromotion = interactive && promotion?.fen === fen ? promotion.value : null;

  const targets = useMemo(
    () => (selected ? legalMovesFrom(chess, selected) : []),
    [chess, selected],
  );

  const select = useCallback((square: Square | null) => {
    setSelection(square ? { fen, value: square } : null);
  }, [fen]);

  /**
   * Play a move, or open the promotion picker first. Returns true only when the
   * move was played right away. A pending promotion returns false so a dragged
   * pawn snaps back until a piece is chosen.
   */
  const attemptMove = useCallback(
    (from: Square, to: Square): boolean => {
      select(null);
      if (needsPromotion(chess, from, to)) {
        setPromotion({ fen, value: { from, to } });
        return false;
      }
      return onMove({ from, to });
    },
    [chess, fen, onMove, select],
  );

  const handleSquareClick = ({ square }: SquareHandlerArgs) => {
    if (!interactive || pendingPromotion || !isSquare(square)) return;
    if (selected && square !== selected && targets.some((move) => move.to === square)) {
      attemptMove(selected, square);
      return;
    }
    if (square === selected || !isOwnPiece(chess, square)) {
      select(null);
      return;
    }
    select(square);
  };

  const handlePieceDrag = ({ square }: PieceHandlerArgs) => {
    if (isSquare(square)) select(square);
  };

  const handlePieceDrop = ({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
    if (!interactive || !isSquare(sourceSquare) || !isSquare(targetSquare)) {
      select(null);
      return false;
    }
    if (sourceSquare === targetSquare) return false;
    return attemptMove(sourceSquare, targetSquare);
  };

  const canDragPiece = ({ square }: PieceHandlerArgs) =>
    interactive && !pendingPromotion && isSquare(square) && isOwnPiece(chess, square);

  const choosePromotion = (piece: PromotionPiece) => {
    if (!pendingPromotion) return;
    setPromotion(null);
    onMove({ ...pendingPromotion, promotion: piece });
  };

  const cancelPromotion = useCallback(() => setPromotion(null), []);

  const squareStyles = useMemo(() => {
    const layers = new Map<string, { tint?: string; images: string[] }>();
    const layer = (square: string) => {
      let entry = layers.get(square);
      if (!entry) {
        entry = { images: [] };
        layers.set(square, entry);
      }
      return entry;
    };

    if (lastMove) {
      layer(lastMove.from).tint = LAST_MOVE_TINT;
      layer(lastMove.to).tint = LAST_MOVE_TINT;
    }
    if (selected) layer(selected).tint = SELECTED_TINT;
    for (const move of targets) {
      layer(move.to).images.push(move.isCapture() ? CAPTURE_RING : MOVE_DOT);
    }
    if (chess.inCheck()) {
      const king = kingSquare(chess, chess.turn());
      if (king) layer(king).images.push(CHECK_GLOW);
    }

    const styles: Record<string, CSSProperties> = {};
    for (const [square, { tint, images }] of layers) {
      styles[square] = {
        ...(tint ? { backgroundColor: tint } : {}),
        ...(images.length ? { backgroundImage: images.join(", ") } : {}),
      };
    }
    return styles;
  }, [chess, lastMove, selected, targets]);

  return (
    <div className="relative w-full" data-testid="game-board">
      <Chessboard
        options={{
          id: "game",
          position: fen,
          boardOrientation: orientation,
          squareStyles,
          allowDragging: interactive,
          allowDrawingArrows: true,
          animationDurationInMs: 200,
          canDragPiece,
          onPieceDrag: handlePieceDrag,
          onPieceDrop: handlePieceDrop,
          onSquareClick: handleSquareClick,
          boardStyle: { borderRadius: "0.5rem", overflow: "hidden" },
        }}
      />
      {pendingPromotion && (
        <PromotionPicker
          color={chess.turn()}
          onSelect={choosePromotion}
          onCancel={cancelPromotion}
        />
      )}
    </div>
  );
}
