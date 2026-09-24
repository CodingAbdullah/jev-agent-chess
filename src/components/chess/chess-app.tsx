"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useChessGame } from "@/hooks/use-chess-game";
import { COLOR_NAME, describeStatus, type GameStatus } from "@/lib/chess/game";
import { cn } from "@/lib/utils";
import { GameBoard } from "./game-board";

export function ChessApp() {
  const { chess, status, lastMove, moveCount, makeMove, reset } = useChessGame();
  const gameOver = status.kind !== "playing";

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <h1 className="text-lg font-semibold tracking-tight">♟ Jev Chess</h1>
        <Button onClick={reset} disabled={moveCount === 0}>
          New game
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center gap-6 p-4 sm:p-6 lg:flex-row lg:items-start lg:justify-center">
        <div className="w-full max-w-[min(100%,640px,calc(100dvh_-_9rem))] min-w-[280px]">
          <GameBoard
            chess={chess}
            lastMove={lastMove}
            interactive={!gameOver}
            onMove={makeMove}
          />
        </div>

        <aside className="w-full max-w-[640px] lg:w-72">
          <Card>
            <CardHeader>
              <CardTitle>Game</CardTitle>
              <CardDescription>
                <Badge variant="secondary">2 Players</Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <StatusLine status={status} />
              {gameOver && (
                <Button variant="outline" onClick={reset}>
                  Play again
                </Button>
              )}
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}

function StatusLine({ status }: { status: GameStatus }) {
  const sideToShow =
    status.kind === "playing" ? status.turn : status.kind === "checkmate" ? status.winner : null;

  return (
    <div className="flex items-center gap-3">
      {sideToShow && (
        <span
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 rounded-full border",
            sideToShow === "w" ? "bg-white border-neutral-400" : "bg-neutral-900 border-neutral-900",
          )}
        />
      )}
      <p role="status" aria-live="polite" className="text-sm font-medium" data-testid="game-status">
        {describeStatus(status)}
      </p>
      {status.kind === "playing" && status.inCheck && (
        <Badge variant="destructive" className="ml-auto">
          Check
        </Badge>
      )}
      {status.kind !== "playing" && (
        <Badge className="ml-auto">
          {status.kind === "checkmate" ? `${COLOR_NAME[status.winner]} wins` : "Draw"}
        </Badge>
      )}
    </div>
  );
}
