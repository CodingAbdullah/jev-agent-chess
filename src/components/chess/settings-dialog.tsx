"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useSettings } from "@/hooks/use-settings";
import { BOARD_THEMES } from "@/lib/board-themes";

const APPEARANCES = [
  { id: "light", label: "Light", Icon: SunIcon },
  { id: "dark", label: "Dark", Icon: MoonIcon },
  { id: "system", label: "System", Icon: MonitorIcon },
] as const;

type SettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [settings, updateSettings] = useSettings();
  const { theme, setTheme } = useTheme();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Saved on this device.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label id="appearance-label">Appearance</Label>
          <ToggleGroup
            type="single"
            value={theme ?? "system"}
            onValueChange={(value) => value && setTheme(value)}
            variant="outline"
            aria-labelledby="appearance-label"
            className="grid w-full grid-cols-3"
          >
            {APPEARANCES.map(({ id, label, Icon }) => (
              <ToggleGroupItem key={id} value={id}>
                <Icon aria-hidden="true" />
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex flex-col gap-2">
          <Label id="board-theme-label">Board</Label>
          <ToggleGroup
            type="single"
            value={settings.boardTheme}
            onValueChange={(value) => value && updateSettings({ boardTheme: value })}
            variant="outline"
            spacing={2}
            aria-labelledby="board-theme-label"
            className="grid w-full grid-cols-4"
          >
            {BOARD_THEMES.map((boardTheme) => (
              <ToggleGroupItem
                key={boardTheme.id}
                value={boardTheme.id}
                className="h-auto flex-col gap-1 py-2"
              >
                <span
                  aria-hidden="true"
                  className="grid size-8 grid-cols-2 overflow-hidden rounded-sm"
                >
                  <span style={{ background: boardTheme.light }} />
                  <span style={{ background: boardTheme.dark }} />
                  <span style={{ background: boardTheme.dark }} />
                  <span style={{ background: boardTheme.light }} />
                </span>
                <span className="text-xs">{boardTheme.label}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="sound-switch">Sound</Label>
          <Switch
            id="sound-switch"
            checked={settings.sound}
            onCheckedChange={(sound) => updateSettings({ sound })}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="evaluation-switch">Evaluation bar</Label>
            <p className="text-muted-foreground text-xs">Stockfish&apos;s view of the position, beside the board.</p>
          </div>
          <Switch
            id="evaluation-switch"
            checked={settings.showEvaluation}
            onCheckedChange={(showEvaluation) => updateSettings({ showEvaluation })}
          />
        </div>

        <div className="flex items-center justify-between gap-4 pl-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="evaluation-computer-switch">Also during games against the computer</Label>
            <p className="text-muted-foreground text-xs">
              Off keeps hints hidden until the game ends, including Stockfish&apos;s evaluation and expected line.
            </p>
          </div>
          <Switch
            id="evaluation-computer-switch"
            checked={settings.showEvaluation && settings.evaluationInComputerGames}
            disabled={!settings.showEvaluation}
            onCheckedChange={(evaluationInComputerGames) => updateSettings({ evaluationInComputerGames })}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="coordinates-switch">Board coordinates</Label>
          <Switch
            id="coordinates-switch"
            checked={settings.showCoordinates}
            onCheckedChange={(showCoordinates) => updateSettings({ showCoordinates })}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
