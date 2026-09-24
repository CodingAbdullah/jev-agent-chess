import { cn } from "@/lib/utils";

type EvalBarProps = {
  /** White's share of the bar, from 0 to 1, or null while unknown. */
  whiteShare: number | null;
  /** Spoken description, such as "Evaluation +0.35. White is slightly better." */
  label: string;
  orientation: "white" | "black";
  className?: string;
};

/**
 * A vertical bar beside the board. White's part grows from White's side of the
 * board, so it follows the board when it is flipped.
 */
export function EvalBar({ whiteShare, label, orientation, className }: EvalBarProps) {
  const share = whiteShare ?? 0.5;
  return (
    <div
      role="img"
      aria-label={label}
      data-testid="eval-bar"
      data-white-share={whiteShare === null ? "" : share.toFixed(3)}
      className={cn(
        "relative w-3 shrink-0 overflow-hidden rounded-sm border border-neutral-400 bg-neutral-700 sm:w-4 dark:border-neutral-600",
        whiteShare === null && "opacity-60",
        className,
      )}
    >
      <div
        className={cn(
          "absolute inset-x-0 bg-neutral-100 transition-[height] duration-500 ease-out",
          orientation === "white" ? "bottom-0" : "top-0",
        )}
        style={{ height: `${share * 100}%` }}
      />
      {/* The midpoint, so small advantages are easy to read. */}
      <div className="absolute inset-x-0 top-1/2 h-px bg-neutral-400" aria-hidden="true" />
    </div>
  );
}
