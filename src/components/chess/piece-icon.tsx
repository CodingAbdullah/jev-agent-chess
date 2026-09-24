import { defaultPieces } from "react-chessboard";
import type { Color, PieceSymbol } from "@/lib/chess/game";

/** A chess piece drawn with the same artwork as the board. */
export function PieceIcon({
  color,
  type,
  className,
}: {
  color: Color;
  type: PieceSymbol;
  className?: string;
}) {
  const render = defaultPieces[`${color}${type.toUpperCase()}`];
  return (
    <span className={className} aria-hidden="true">
      {render?.({ svgStyle: { width: "100%", height: "100%" } })}
    </span>
  );
}
