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

const MODES = [
  { id: "local", label: "2 Players", available: true },
  { id: "jev", label: "vs Jev", available: false },
  { id: "stockfish", label: "vs Stockfish", available: false },
  { id: "hybrid", label: "Hybrid", available: false },
] as const;

type NewGameDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTimeControl: string;
  onStart: (timeControlId: string) => void;
};

export function NewGameDialog({ open, onOpenChange, defaultTimeControl, onStart }: NewGameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Remount the form each time the dialog opens, so it starts from the saved time control. */}
        {open && (
          <NewGameForm
            defaultTimeControl={defaultTimeControl}
            onStart={(id) => {
              onStart(id);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function NewGameForm({
  defaultTimeControl,
  onStart,
}: {
  defaultTimeControl: string;
  onStart: (timeControlId: string) => void;
}) {
  const [timeControl, setTimeControl] = useState(defaultTimeControl);

  return (
    <>
      <DialogHeader>
        <DialogTitle>New game</DialogTitle>
        <DialogDescription>Starting a new game ends the current one.</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <Label id="mode-label">Mode</Label>
        <ToggleGroup
          type="single"
          value="local"
          variant="outline"
          aria-labelledby="mode-label"
          className="grid w-full grid-cols-2"
        >
          {MODES.map((mode) => (
            <ToggleGroupItem
              key={mode.id}
              value={mode.id}
              disabled={!mode.available}
              className="justify-between gap-2"
            >
              {mode.label}
              {!mode.available && (
                <Badge variant="secondary" className="text-[10px]">
                  Soon
                </Badge>
              )}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="flex flex-col gap-2">
        <Label id="time-label">Time control</Label>
        <ToggleGroup
          type="single"
          value={timeControl}
          onValueChange={(value) => value && setTimeControl(value)}
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
      </div>

      <DialogFooter>
        <Button onClick={() => onStart(timeControl)} className="w-full sm:w-auto">
          Start game
        </Button>
      </DialogFooter>
    </>
  );
}
