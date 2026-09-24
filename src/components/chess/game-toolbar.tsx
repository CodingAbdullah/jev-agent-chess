"use client";

import { ArrowDownUpIcon, FileTextIcon, SettingsIcon, Undo2Icon, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type GameToolbarProps = {
  canUndo: boolean;
  onUndo: () => void;
  onFlip: () => void;
  onImportExport: () => void;
  onSettings: () => void;
};

export function GameToolbar({ canUndo, onUndo, onFlip, onImportExport, onSettings }: GameToolbarProps) {
  return (
    <div role="toolbar" aria-label="Game controls" className="grid grid-cols-4 gap-2">
      <ToolbarButton icon={Undo2Icon} label="Undo" hint="Take back the last move" onClick={onUndo} disabled={!canUndo} />
      <ToolbarButton icon={ArrowDownUpIcon} label="Flip board" hint="View from the other side" onClick={onFlip} />
      <ToolbarButton icon={FileTextIcon} label="FEN / PGN" hint="Import or export a game" onClick={onImportExport} />
      <ToolbarButton icon={SettingsIcon} label="Settings" hint="Theme, board and sound" onClick={onSettings} />
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  hint,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" onClick={onClick} disabled={disabled} aria-label={label} className="px-2">
          <Icon aria-hidden="true" />
          <span className="hidden truncate sm:inline">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}
