"use client";

import { useEffect, useRef } from "react";
import type { MoveRow } from "@/lib/chess/game";
import { cn } from "@/lib/utils";

type MoveHistoryProps = {
  rows: readonly MoveRow[];
  /** The move to highlight: the latest, or the one being reviewed. -1 for none. */
  lastPly: number;
  /** When set, each move is a button that shows the position after it. */
  onSelectPly?: (ply: number) => void;
  className?: string;
};

export function MoveHistory({ rows, lastPly, onSelectPly, className }: MoveHistoryProps) {
  const scroller = useRef<HTMLDivElement>(null);

  // Keep the newest move, or the one being reviewed, in view.
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const current = element.querySelector<HTMLElement>('[aria-current="step"]');
    if (onSelectPly && current) {
      element.scrollTop = current.offsetTop - element.clientHeight / 2;
    } else {
      element.scrollTop = element.scrollHeight;
    }
  }, [lastPly, onSelectPly]);

  return (
    <div ref={scroller} className={cn("relative overflow-y-auto", className)}>
      {rows.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">No moves yet.</p>
      ) : (
        <ol aria-label="Move history" className="grid grid-cols-[2.5rem_1fr_1fr] text-sm">
          {rows.map((row) => (
            <li key={row.number} className="contents">
              <span className="text-muted-foreground py-1 pr-2 text-right tabular-nums">
                {row.number}.
              </span>
              <MoveCell move={row.white} lastPly={lastPly} onSelect={onSelectPly} placeholder={row.black ? "…" : ""} />
              <MoveCell move={row.black} lastPly={lastPly} onSelect={onSelectPly} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function MoveCell({
  move,
  lastPly,
  onSelect,
  placeholder = "",
}: {
  move?: { san: string; ply: number };
  lastPly: number;
  onSelect?: (ply: number) => void;
  placeholder?: string;
}) {
  const current = move !== undefined && move.ply === lastPly;
  const className = cn(
    "rounded px-2 py-1 text-left font-medium",
    current && "bg-accent text-accent-foreground",
    !move && "text-muted-foreground",
  );
  if (move && onSelect) {
    return (
      <button
        type="button"
        data-ply={move.ply}
        aria-current={current ? "step" : undefined}
        className={cn(className, "hover:bg-accent/60 focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]")}
        onClick={() => onSelect(move.ply + 1)}
      >
        {move.san}
      </button>
    );
  }
  return (
    <span data-ply={move?.ply} aria-current={current ? "step" : undefined} className={className}>
      {move?.san ?? placeholder}
    </span>
  );
}
