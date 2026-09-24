import type { ClockState } from "@/lib/chess/clock";
import { PIECE_NAME } from "@/lib/chess/describe";
import { COLOR_NAME, opponent, type Color, type PieceSymbol } from "@/lib/chess/game";
import { cn } from "@/lib/utils";
import { ChessClock } from "./chess-clock";
import { PieceIcon } from "./piece-icon";

type PlayerBarProps = {
  color: Color;
  name: string;
  /** Opponent pieces this player has taken. */
  captured: readonly PieceSymbol[];
  /** This player's material lead in pawns. Shown only when positive. */
  lead: number;
  clock: ClockState | null;
  turn: Color;
  active: boolean;
};

export function PlayerBar({ color, name, captured, lead, clock, turn, active }: PlayerBarProps) {
  return (
    <div
      className="flex min-h-12 items-center gap-3 py-1"
      data-testid={`player-${color}`}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-3 shrink-0 rounded-full border",
          color === "w" ? "border-neutral-400 bg-white" : "border-neutral-900 bg-neutral-900 dark:border-neutral-500",
          active && "ring-primary ring-2 ring-offset-2 ring-offset-background",
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold">{name}</span>
        <div
          className="flex h-5 items-center"
          role="img"
          aria-label={
            captured.length
              ? `${COLOR_NAME[color]} has captured ${captured.map((type) => PIECE_NAME[type]).join(", ")}${lead > 0 ? `, ahead by ${lead}` : ""}`
              : `${COLOR_NAME[color]} has captured nothing`
          }
          data-testid={`captured-by-${color}`}
        >
          {captured.map((type, index) => (
            <PieceIcon
              key={index}
              color={opponent(color)}
              type={type}
              className="-ml-1.5 size-5 first:ml-0"
            />
          ))}
          {lead > 0 && (
            <span className="text-muted-foreground ml-1 text-xs font-medium" data-testid={`lead-${color}`}>
              +{lead}
            </span>
          )}
        </div>
      </div>
      {clock && <ChessClock clock={clock} color={color} turn={turn} />}
    </div>
  );
}
