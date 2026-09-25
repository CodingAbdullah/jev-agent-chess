import type { Color } from "chess.js";

/** A time control in milliseconds. */
export type TimeControl = { initialMs: number; incrementMs: number };

export type TimeControlOption = {
  id: string;
  label: string;
  category: "Unlimited" | "Bullet" | "Blitz" | "Rapid" | "Classical";
  control: TimeControl | null;
};

const minutes = (m: number) => m * 60_000;
const seconds = (s: number) => s * 1_000;

export const TIME_CONTROLS: readonly TimeControlOption[] = [
  { id: "unlimited", label: "Unlimited", category: "Unlimited", control: null },
  { id: "1+0", label: "1 min", category: "Bullet", control: { initialMs: minutes(1), incrementMs: 0 } },
  { id: "3+2", label: "3 | 2", category: "Blitz", control: { initialMs: minutes(3), incrementMs: seconds(2) } },
  { id: "5+0", label: "5 min", category: "Blitz", control: { initialMs: minutes(5), incrementMs: 0 } },
  { id: "10+0", label: "10 min", category: "Rapid", control: { initialMs: minutes(10), incrementMs: 0 } },
  { id: "15+10", label: "15 | 10", category: "Rapid", control: { initialMs: minutes(15), incrementMs: seconds(10) } },
  { id: "30+0", label: "30 min", category: "Classical", control: { initialMs: minutes(30), incrementMs: 0 } },
];

export const DEFAULT_TIME_CONTROL_ID = "10+0";

export function findTimeControl(id: string): TimeControlOption {
  return (
    TIME_CONTROLS.find((option) => option.id === id) ??
    TIME_CONTROLS.find((option) => option.id === DEFAULT_TIME_CONTROL_ID)!
  );
}

/**
 * Both players' remaining time. `runningSince` is when the side to move's
 * clock started, or null while the clock is stopped.
 */
export type ClockState = {
  remaining: Record<Color, number>;
  runningSince: number | null;
};

export function initialClock(control: TimeControl | null): ClockState | null {
  if (!control) return null;
  return {
    remaining: { w: control.initialMs, b: control.initialMs },
    runningSince: null,
  };
}

/** Time left for `color` at `now`. Only the side to move loses time while the clock runs. */
export function timeLeft(clock: ClockState, color: Color, turn: Color, now: number): number {
  const elapsed =
    clock.runningSince !== null && color === turn ? Math.max(0, now - clock.runningSince) : 0;
  return Math.max(0, clock.remaining[color] - elapsed);
}

/**
 * The clock after `mover` plays a move at `now`. The mover's elapsed time is
 * charged and the increment added, then the opponent's clock starts.
 * The first move of a game is free and simply starts the clock.
 */
export function clockAfterMove(
  clock: ClockState,
  mover: Color,
  now: number,
  control: TimeControl,
): ClockState {
  if (clock.runningSince === null) {
    return { remaining: { ...clock.remaining }, runningSince: now };
  }
  const left = timeLeft(clock, mover, mover, now);
  return {
    remaining: { ...clock.remaining, [mover]: left + control.incrementMs },
    runningSince: now,
  };
}

/** Stop the clock at `now`, charging the side to move for the time used so far. */
export function stopClock(clock: ClockState, turn: Color, now: number): ClockState {
  if (clock.runningSince === null) return clock;
  return {
    remaining: { ...clock.remaining, [turn]: timeLeft(clock, turn, turn, now) },
    runningSince: null,
  };
}

/** Format milliseconds as m:ss, h:mm:ss, or s.t under ten seconds. */
export function formatClock(ms: number): string {
  const clamped = Math.max(0, ms);
  if (clamped < 10_000) {
    const tenths = Math.floor(clamped / 100);
    return `0:0${Math.floor(tenths / 10)}.${tenths % 10}`;
  }
  const totalSeconds = Math.ceil(clamped / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = String(totalSeconds % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(mins).padStart(2, "0")}:${secs}` : `${mins}:${secs}`;
}
