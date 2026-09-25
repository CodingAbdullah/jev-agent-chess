"use client";

import { CheckIcon, CopyIcon, DownloadIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { parseGameText, type LoadedGame } from "@/lib/chess/game";

export type ImportExportTab = "export" | "import";

type ImportExportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab: ImportExportTab;
  fen: string;
  pgn: string;
  onImport: (game: LoadedGame) => void;
};

export function ImportExportDialog({
  open,
  onOpenChange,
  initialTab,
  fen,
  pgn,
  onImport,
}: ImportExportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import and export</DialogTitle>
          <DialogDescription>Share a position as FEN or a whole game as PGN.</DialogDescription>
        </DialogHeader>
        {open && (
          <Tabs defaultValue={initialTab} className="min-w-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="export">Export</TabsTrigger>
              <TabsTrigger value="import">Import</TabsTrigger>
            </TabsList>
            <TabsContent value="export" className="flex min-w-0 flex-col gap-4 pt-2">
              <ExportField id="export-fen" label="FEN" value={fen} rows={2} />
              <ExportField id="export-pgn" label="PGN" value={pgn} rows={7} download />
            </TabsContent>
            <TabsContent value="import" className="pt-2">
              <ImportForm
                onImport={(game) => {
                  onImport(game);
                  onOpenChange(false);
                }}
              />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ExportField({
  id,
  label,
  value,
  rows,
  download = false,
}: {
  id: string;
  label: string;
  value: string;
  rows: number;
  download?: boolean;
}) {
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied("yes");
    } catch {
      // Clipboard access can be blocked. Select the text so it can be copied by hand.
      const field = document.getElementById(id) as HTMLTextAreaElement | null;
      field?.select();
      setCopied("failed");
    }
    setTimeout(() => setCopied(null), 2000);
  };

  const save = () => {
    const url = URL.createObjectURL(new Blob([value], { type: "application/x-chess-pgn" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "jev-chess-game.pgn";
    link.click();
    // Revoking right away can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <div className="flex gap-2">
          {download && (
            <Button variant="outline" size="sm" onClick={save}>
              <DownloadIcon aria-hidden="true" />
              Download
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={copy} aria-label={`Copy ${label}`}>
            {copied === "yes" ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
            {copied === "yes" ? "Copied" : copied === "failed" ? "Press Ctrl+C" : "Copy"}
          </Button>
        </div>
      </div>
      <Textarea
        id={id}
        readOnly
        value={value}
        rows={rows}
        className="resize-none font-mono text-xs break-all"
        onFocus={(event) => event.currentTarget.select()}
      />
    </div>
  );
}

function ImportForm({ onImport }: { onImport: (game: LoadedGame) => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = parseGameText(text);
    if (result.ok) onImport(result.game);
    else setError(result.error);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Label htmlFor="import-text">Paste a FEN or PGN</Label>
      <Textarea
        id="import-text"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setError(null);
        }}
        rows={7}
        placeholder={"1. e4 e5 2. Nf3 Nc6\n\nor\n\nrnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"}
        className="font-mono text-xs"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "import-error" : undefined}
      />
      {error && (
        <p id="import-error" role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <p className="text-muted-foreground text-xs">
        Loading replaces the current game and resets the clocks.
      </p>
      <Button type="submit" className="self-end">
        Load game
      </Button>
    </form>
  );
}
