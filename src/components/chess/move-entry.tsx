"use client";

import type { Chess } from "chess.js";
import { KeyboardIcon } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { parseTypedMove, type MoveInput as MoveInputValue } from "@/lib/chess/game";
import { cn } from "@/lib/utils";

type MoveEntryProps = {
  chess: Chess;
  /** When false, the field is disabled and says why. */
  enabled: boolean;
  disabledReason: string;
  /** Returns true when the move was played. */
  onMove: (move: MoveInputValue) => boolean;
  className?: string;
};

/**
 * Play by typing a move, such as "e4", "Nf3" or "e7e8q". This is the keyboard
 * and screen reader way to play, since the board itself works by pointer.
 */
export function MoveEntry({ chess, enabled, disabledReason, onMove, className }: MoveEntryProps) {
  const id = useId();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = parseTypedMove(chess, text);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (onMove(result.move)) {
      setText("");
      setError(null);
    } else {
      setError(`${result.san} could not be played.`);
    }
  };

  return (
    <form onSubmit={submit} className={cn("flex flex-col gap-1", className)} aria-label="Type a move">
      <div className="flex gap-2">
        <label htmlFor={`${id}-move`} className="sr-only">
          Type a move
        </label>
        <div className="relative flex-1">
          <KeyboardIcon
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
          />
          <input
            id={`${id}-move`}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setError(null);
            }}
            disabled={!enabled}
            placeholder={enabled ? "Type a move, like e4 or Nf3" : disabledReason}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive h-9 w-full min-w-0 rounded-md border py-1 pr-3 pl-8 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
        <Button type="submit" variant="outline" disabled={!enabled}>
          Play
        </Button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </form>
  );
}
