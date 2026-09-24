"use client";

import { useEffect, useRef } from "react";
import { defaultPieces } from "react-chessboard";
import { Button } from "@/components/ui/button";
import {
  PROMOTION_PIECES,
  type Color,
  type PromotionPiece,
} from "@/lib/chess/game";

const PIECE_NAME: Record<PromotionPiece, string> = {
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
};

type PromotionPickerProps = {
  color: Color;
  onSelect: (piece: PromotionPiece) => void;
  onCancel: () => void;
};

/** An overlay over the board that asks which piece a pawn promotes to. */
export function PromotionPicker({ color, onSelect, onCancel }: PromotionPickerProps) {
  const firstButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="promotion-title"
        className="bg-card text-card-foreground rounded-xl border p-4 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <p id="promotion-title" className="mb-3 text-center text-sm font-medium">
          Promote pawn to
        </p>
        <div className="flex gap-2">
          {PROMOTION_PIECES.map((piece, index) => {
            const renderPiece = defaultPieces[`${color}${piece.toUpperCase()}`];
            return (
              <Button
                key={piece}
                ref={index === 0 ? firstButton : undefined}
                variant="outline"
                className="size-14 p-1 sm:size-16 [&_svg:not([class*='size-'])]:size-full"
                aria-label={`Promote to ${PIECE_NAME[piece]}`}
                onClick={() => onSelect(piece)}
              >
                {renderPiece?.({ svgStyle: { width: "100%", height: "100%" } })}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
