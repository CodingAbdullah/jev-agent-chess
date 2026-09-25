"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { describeMove } from "@/lib/chess/describe";
import type { Color, Move } from "@/lib/chess/game";

type ReviewControlsProps = {
  /** How many moves are on the board being shown, from 0 (the start) to `history.length`. */
  ply: number;
  history: readonly Move[];
  names: Record<Color, string>;
  onGo: (ply: number) => void;
};

/** A plain description of the position being reviewed, for the caption and screen readers. */
export function describeReviewPosition(ply: number, history: readonly Move[], names: Record<Color, string>) {
  const move = history[ply - 1];
  if (!move) return "Starting position.";
  const number = move.before.split(" ")[5] ?? "";
  const san = move.color === "w" ? `${number}. ${move.san}` : `${number}… ${move.san}`;
  return `Move ${ply} of ${history.length}, ${san}: ${names[move.color]} played ${describeMove(move)}.`;
}

/**
 * Step through a finished game. The arrow keys, Home and End do the same
 * from anywhere on the page, handled by the game screen.
 */
export function ReviewControls({ ply, history, names, onGo }: ReviewControlsProps) {
  const last = history.length;
  return (
    <div className="flex flex-col gap-2 rounded-md border p-2" data-testid="review">
      <div role="toolbar" aria-label="Review the game" className="grid grid-cols-4 gap-2">
        <StepButton icon={ChevronsLeftIcon} label="First position" onClick={() => onGo(0)} disabled={ply === 0} />
        <StepButton icon={ChevronLeftIcon} label="Previous move" onClick={() => onGo(ply - 1)} disabled={ply === 0} />
        <StepButton icon={ChevronRightIcon} label="Next move" onClick={() => onGo(ply + 1)} disabled={ply === last} />
        <StepButton icon={ChevronsRightIcon} label="Final position" onClick={() => onGo(last)} disabled={ply === last} />
      </div>
      <p className="text-muted-foreground px-1 text-xs" aria-live="polite" data-testid="review-position">
        {describeReviewPosition(ply, history, names)}
      </p>
    </div>
  );
}

function StepButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <Button variant="outline" size="sm" aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      <Icon aria-hidden="true" />
    </Button>
  );
}
