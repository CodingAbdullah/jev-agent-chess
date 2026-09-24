"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TIME_CONTROLS } from "@/lib/chess/clock";
import { DIFFICULTIES, PERSONALITIES, type DifficultyId } from "@/lib/jev/types";
import { STOCKFISH_LEVELS } from "@/lib/stockfish/uci";
import type { Settings } from "@/lib/settings";

const MODES = [
  { id: "jev", label: "vs Jev", available: true },
  { id: "local", label: "2 Players", available: true },
  { id: "stockfish", label: "vs Stockfish", available: true },
  { id: "hybrid", label: "Hybrid", available: false },
] as const;

const COLORS = [
  { id: "w", label: "White" },
  { id: "b", label: "Black" },
  { id: "random", label: "Random" },
] as const;

/** The choices this dialog makes. They are saved as settings for next time. */
export type GameSetup = Pick<Settings, "mode" | "timeControl" | "playerColor" | "personality" | "difficulty">;

const stockfishHint = (id: DifficultyId) => {
  const level = STOCKFISH_LEVELS[id];
  return `Skill level ${level.skill} of 20, searching up to ${level.depth} moves deep.`;
};

type NewGameDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaults: GameSetup;
  onStart: (setup: GameSetup) => void;
};

export function NewGameDialog({ open, onOpenChange, defaults, onStart }: NewGameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        {/* Remount the form each time the dialog opens, so it starts from the saved setup. */}
        {open && (
          <NewGameForm
            defaults={defaults}
            onStart={(setup) => {
              onStart(setup);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function NewGameForm({ defaults, onStart }: { defaults: GameSetup; onStart: (setup: GameSetup) => void }) {
  const [setup, setSetup] = useState(defaults);
  const update = (patch: Partial<GameSetup>) => setSetup((current) => ({ ...current, ...patch }));
  const personality = PERSONALITIES.find((option) => option.id === setup.personality);
  const difficulty = DIFFICULTIES.find((option) => option.id === setup.difficulty);
  const againstComputer = setup.mode === "jev" || setup.mode === "stockfish";
  const difficultyHint =
    setup.mode === "stockfish" ? stockfishHint(setup.difficulty) : difficulty?.description;

  return (
    <>
      <DialogHeader>
        <DialogTitle>New game</DialogTitle>
        <DialogDescription>Starting a new game ends the current one.</DialogDescription>
      </DialogHeader>

      <Field label="Mode" id="mode">
        <ToggleGroup
          type="single"
          value={setup.mode}
          onValueChange={(value) =>
            (value === "jev" || value === "local" || value === "stockfish") && update({ mode: value })
          }
          variant="outline"
          aria-labelledby="mode-label"
          className="grid w-full grid-cols-2"
        >
          {MODES.map((mode) => (
            <ToggleGroupItem key={mode.id} value={mode.id} disabled={!mode.available} className="justify-between gap-2">
              {mode.label}
              {!mode.available && (
                <Badge variant="secondary" className="text-[10px]">
                  Soon
                </Badge>
              )}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      {againstComputer && (
        <>
          <Field label="You play" id="color">
            <ToggleGroup
              type="single"
              value={setup.playerColor}
              onValueChange={(value) =>
                (value === "w" || value === "b" || value === "random") && update({ playerColor: value })
              }
              variant="outline"
              aria-labelledby="color-label"
              className="grid w-full grid-cols-3"
            >
              {COLORS.map((color) => (
                <ToggleGroupItem key={color.id} value={color.id}>
                  {color.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>

          {setup.mode === "jev" && (
            <Field label="Jev's personality" id="personality" hint={personality?.description}>
              <ToggleGroup
                type="single"
                value={setup.personality}
                onValueChange={(value) => {
                  const match = PERSONALITIES.find((option) => option.id === value);
                  if (match) update({ personality: match.id });
                }}
                variant="outline"
                spacing={2}
                aria-labelledby="personality-label"
                className="grid w-full grid-cols-2 sm:grid-cols-3"
              >
                {PERSONALITIES.map((option) => (
                  <ToggleGroupItem key={option.id} value={option.id}>
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
          )}

          <Field label="Difficulty" id="difficulty" hint={difficultyHint}>
            <ToggleGroup
              type="single"
              value={setup.difficulty}
              onValueChange={(value) => {
                const match = DIFFICULTIES.find((option) => option.id === value);
                if (match) update({ difficulty: match.id });
              }}
              variant="outline"
              aria-labelledby="difficulty-label"
              className="grid w-full grid-cols-3"
            >
              {DIFFICULTIES.map((option) => (
                <ToggleGroupItem key={option.id} value={option.id}>
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
        </>
      )}

      <Field label="Time control" id="time">
        <ToggleGroup
          type="single"
          value={setup.timeControl}
          onValueChange={(value) => value && update({ timeControl: value })}
          variant="outline"
          spacing={2}
          aria-labelledby="time-label"
          className="grid w-full grid-cols-3 sm:grid-cols-4"
        >
          {TIME_CONTROLS.map((option) => (
            <ToggleGroupItem
              key={option.id}
              value={option.id}
              aria-label={option.control ? `${option.label}, ${option.category}` : "Unlimited, no clock"}
              className="h-auto flex-col gap-0 py-2"
            >
              <span className="font-semibold">{option.label}</span>
              <span className="text-muted-foreground text-[11px] font-normal">
                {option.control ? option.category : "No clock"}
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      <DialogFooter>
        <Button onClick={() => onStart(setup)} className="w-full sm:w-auto">
          Start game
        </Button>
      </DialogFooter>
    </>
  );
}

function Field({
  label,
  id,
  hint,
  children,
}: {
  label: string;
  id: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label id={`${id}-label`}>{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}
