"use client";

import { AlertTriangleIcon, LoaderCircleIcon, RotateCwIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AiDecision } from "@/hooks/use-ai-opponent";
import { COLOR_NAME, type Color } from "@/lib/chess/game";
import { difficultyLabel, type DifficultyId } from "@/lib/jev/types";
import type { StockfishMove } from "@/lib/stockfish/player";
import { describeScore, formatScore, STOCKFISH_LEVELS } from "@/lib/stockfish/uci";

type StockfishPanelProps = {
  stockfishColor: Color;
  difficulty: DifficultyId;
  thinking: boolean;
  error: string | null;
  decision: AiDecision<StockfishMove> | null;
  gameOver: boolean;
  /** When false, the evaluation and expected line stay hidden, since they hint at your best move. */
  showAnalysis: boolean;
  onRetry: () => void;
};

export function StockfishPanel({
  stockfishColor,
  difficulty,
  thinking,
  error,
  decision,
  gameOver,
  showAnalysis,
  onRetry,
}: StockfishPanelProps) {
  const level = STOCKFISH_LEVELS[difficulty];
  return (
    <Card className="gap-3" data-testid="stockfish-panel">
      <CardHeader className="gap-2">
        <CardTitle>Stockfish</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Plays {COLOR_NAME[stockfishColor]}</Badge>
          <Badge variant="secondary">{difficultyLabel(difficulty)}</Badge>
          <Badge variant="outline">
            Skill {level.skill} · depth {level.depth}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div aria-live="polite" data-testid="stockfish-state">
          {thinking ? (
            <p className="flex items-center gap-2 text-sm font-medium">
              <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
              Thinking…
            </p>
          ) : error ? (
            <div role="alert" className="flex flex-col gap-2">
              <p className="text-destructive flex items-start gap-2 text-sm">
                <AlertTriangleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
              <Button variant="outline" size="sm" className="self-start" onClick={onRetry}>
                <RotateCwIcon aria-hidden="true" />
                Try again
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              {gameOver ? "The game is over." : decision ? "Your move." : "Waiting for your first move."}
            </p>
          )}
        </div>

        {decision && (
          <div className="flex flex-col gap-3" data-testid="stockfish-decision">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-muted-foreground text-xs">Played</p>
                <p className="text-2xl font-semibold" data-testid="stockfish-played">
                  {decision.san}
                </p>
              </div>
              {showAnalysis && decision.score && (
                <div className="text-right">
                  <p className="text-muted-foreground text-xs">Evaluation</p>
                  <p className="text-2xl font-semibold tabular-nums" data-testid="stockfish-score">
                    {formatScore(decision.score)}
                  </p>
                </div>
              )}
            </div>
            {!showAnalysis && (
              <p className="text-muted-foreground text-xs" data-testid="stockfish-analysis-hidden">
                Stockfish&apos;s evaluation and expected line appear when the game ends.
              </p>
            )}
            {showAnalysis && decision.score && (
              <p className="text-muted-foreground text-xs">
                {describeScore(decision.score)}, at depth {decision.depth}. Scores are from White&apos;s side.
              </p>
            )}
            {showAnalysis && decision.line.length > 1 && (
              <p className="text-sm">
                <span className="text-muted-foreground">Expected line: </span>
                <span data-testid="stockfish-line">{decision.line.join(" ")}</span>
              </p>
            )}
          </div>
        )}

        <p className="text-muted-foreground text-xs">
          Stockfish 19 Lite runs in your browser. It is free software under the{" "}
          <a className="underline underline-offset-2" href="/stockfish/Copying.txt" target="_blank" rel="noreferrer">
            GPL-3.0 licence
          </a>
          , with{" "}
          <a
            className="underline underline-offset-2"
            href="https://github.com/nmrugg/stockfish.js"
            target="_blank"
            rel="noreferrer"
          >
            source code on GitHub
          </a>
          .
        </p>
      </CardContent>
    </Card>
  );
}
