"use client";

import { useEffect, useState } from "react";
import { formatClock, timeLeft, type ClockState } from "@/lib/chess/clock";
import { COLOR_NAME, type Color } from "@/lib/chess/game";
import { cn } from "@/lib/utils";

const LOW_TIME_MS = 20_000;

type ChessClockProps = {
  clock: ClockState;
  color: Color;
  turn: Color;
};

/** One side's clock. Re-renders a few times a second only while it is running. */
export function ChessClock({ clock, color, turn }: ChessClockProps) {
  const running = clock.runningSince !== null && color === turn;
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [running]);

  const ms = running ? timeLeft(clock, color, turn, Math.max(now, clock.runningSince ?? 0)) : clock.remaining[color];
  const low = ms < LOW_TIME_MS;

  return (
    <div
      role="timer"
      aria-label={`${COLOR_NAME[color]} clock`}
      data-running={running}
      className={cn(
        "min-w-[5.5rem] rounded-md px-3 py-1.5 text-right text-lg font-semibold tabular-nums transition-colors",
        running
          ? low
            ? "bg-destructive text-white"
            : "bg-primary text-primary-foreground"
          : "bg-muted text-foreground",
        !running && ms === 0 && "text-destructive",
      )}
    >
      {formatClock(ms)}
    </div>
  );
}
