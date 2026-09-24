"use client";

import { useEffect, useRef } from "react";
import type { MoveRow } from "@/lib/chess/game";
import { cn } from "@/lib/utils";

type MoveHistoryProps = {
  rows: readonly MoveRow[];
  lastPly: number;
  className?: string;
};

export function MoveHistory({ rows, lastPly, className }: MoveHistoryProps) {
  const scroller = useRef<HTMLDivElement>(null);

  // Keep the newest move in view.
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [lastPly]);

  return (
    <div ref={scroller} className={cn("overflow-y-auto", className)}>
      {rows.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">No moves yet.</p>
      ) : (
        <ol aria-label="Move history" className="grid grid-cols-[2.5rem_1fr_1fr] text-sm">
          {rows.map((row) => (
            <li key={row.number} className="contents">
              <span className="text-muted-foreground py-1 pr-2 text-right tabular-nums">
                {row.number}.
              </span>
              <MoveCell move={row.white} lastPly={lastPly} placeholder={row.black ? "…" : ""} />
              <MoveCell move={row.black} lastPly={lastPly} />
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
  placeholder = "",
}: {
  move?: { san: string; ply: number };
  lastPly: number;
  placeholder?: string;
}) {
  const current = move?.ply === lastPly;
  return (
    <span
      aria-current={current ? "step" : undefined}
      className={cn(
        "rounded px-2 py-1 font-medium",
        current && "bg-accent text-accent-foreground",
        !move && "text-muted-foreground",
      )}
    >
      {move?.san ?? placeholder}
    </span>
  );
}
