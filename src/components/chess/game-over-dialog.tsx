"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  COLOR_NAME,
  describeStatus,
  resultToken,
  statusTitle,
  type Color,
  type GameStatus,
} from "@/lib/chess/game";

type GameOverDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: GameStatus;
  names?: Record<Color, string>;
  /** Extra context, such as which Jev setup played. */
  subtitle?: string;
  onRematch: () => void;
  onExport: () => void;
};

export function GameOverDialog({
  open,
  onOpenChange,
  status,
  names = COLOR_NAME,
  subtitle,
  onRematch,
  onExport,
}: GameOverDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="items-center text-center sm:text-center">
          <p className="text-muted-foreground font-mono text-sm">{resultToken(status)}</p>
          <DialogTitle className="text-2xl">{statusTitle(status)}</DialogTitle>
          <DialogDescription>{describeStatus(status, names)}</DialogDescription>
          {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-center">
          <Button variant="outline" onClick={onExport}>
            Export PGN
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            View board
          </Button>
          <Button onClick={onRematch}>Rematch</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
