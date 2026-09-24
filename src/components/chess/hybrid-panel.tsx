"use client";

import { AlertTriangleIcon, LoaderCircleIcon, RotateCwIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AiDecision } from "@/hooks/use-ai-opponent";
import { COLOR_NAME, type Color } from "@/lib/chess/game";
import { HYBRID_LEVELS, type HybridMove } from "@/lib/hybrid";
import { difficultyLabel, personalityLabel, type DifficultyId, type PersonalityId } from "@/lib/jev/types";
import { formatScore } from "@/lib/stockfish/uci";
import { cn } from "@/lib/utils";

type HybridPanelProps = {
  aiColor: Color;
  personality: PersonalityId;
  difficulty: DifficultyId;
  thinking: boolean;
  error: string | null;
  decision: AiDecision<HybridMove> | null;
  gameOver: boolean;
  onRetry: () => void;
};

const percent = (value: number) => `${Math.round(value * 100)}%`;
const ordinal = (rank: number) => ["", "top", "second", "third", "fourth", "fifth"][rank] ?? `#${rank}`;

export function HybridPanel({
  aiColor,
  personality,
  difficulty,
  thinking,
  error,
  decision,
  gameOver,
  onRetry,
}: HybridPanelProps) {
  return (
    <Card className="gap-3" data-testid="hybrid-panel">
      <CardHeader className="gap-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Jev + Stockfish</CardTitle>
          {decision?.jev && (
            <Badge
              variant="outline"
              data-testid="hybrid-source"
              className={cn(
                decision.jev.source === "mock" && "border-amber-500/60 text-amber-700 dark:text-amber-400",
                decision.jev.source === "fallback" && "border-destructive/60 text-destructive",
              )}
            >
              {decision.jev.source === "jev" ? "Live" : decision.jev.source === "mock" ? "Mock" : "Fallback"}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Plays {COLOR_NAME[aiColor]}</Badge>
          <Badge variant="secondary">{personalityLabel(personality)}</Badge>
          <Badge variant="secondary">{difficultyLabel(difficulty)}</Badge>
        </div>
        <p className="text-muted-foreground text-xs">
          Stockfish shortlists its best moves at depth {HYBRID_LEVELS[difficulty].depth}, and Jev picks the one that
          fits its style.
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div aria-live="polite" data-testid="hybrid-state">
          {thinking ? (
            <p className="flex items-center gap-2 text-sm font-medium">
              <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
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

        {decision && <HybridDecision decision={decision} />}
      </CardContent>
    </Card>
  );
}

function HybridDecision({ decision }: { decision: AiDecision<HybridMove> }) {
  const played = decision.shortlist.find((entry) => entry.san === decision.san);
  const jev = decision.jev;

  let summary: string;
  if (!jev) summary = "Stockfish saw only one sensible move, so Jev had nothing to choose.";
  else if (jev.source === "fallback") summary = `${jev.fallbackReason} Stockfish's top choice was played instead.`;
  else if (played) summary = `Jev chose Stockfish's ${ordinal(played.rank)} choice.`;
  else summary = "Jev chose a move from Stockfish's shortlist.";

  return (
    <div className="flex flex-col gap-4" data-testid="hybrid-decision">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs">Played</p>
          <p className="text-2xl font-semibold" data-testid="hybrid-played">
            {decision.san}
          </p>
        </div>
        {jev?.confidence !== undefined && (
          <div className="text-right">
            <p className="text-muted-foreground text-xs">Jev&apos;s confidence</p>
            <p className="text-2xl font-semibold tabular-nums">{percent(jev.confidence)}</p>
          </div>
        )}
      </div>
      <p className="text-muted-foreground text-xs" data-testid="hybrid-summary">
        {summary}
      </p>
      <Shortlist decision={decision} />
    </div>
  );
}

/**
 * Stockfish's shortlist in its order, with its evaluation as text and Jev's
 * probability as a bar. The move played gets the accent colour and a text tag,
 * and every value is printed, so the list is also its own table view.
 */
function Shortlist({ decision }: { decision: AiDecision<HybridMove> }) {
  const max = Math.max(...decision.shortlist.map((entry) => entry.probability ?? 0), 0.0001);
  const hasJev = decision.shortlist.some((entry) => entry.probability !== undefined);
  return (
    <div className="flex flex-col gap-2">
      <div
        className="text-muted-foreground grid grid-cols-[1.25rem_3.25rem_3.5rem_1fr_2.75rem] gap-2 px-1 text-xs"
        aria-hidden="true"
      >
        <span>#</span>
        <span>Move</span>
        <span className="text-right">Stockfish</span>
        <span className="col-span-2">{hasJev ? "Jev" : ""}</span>
      </div>
      <ol aria-label="Stockfish's shortlist with Jev's probabilities" className="flex flex-col gap-1" data-testid="hybrid-shortlist">
        {decision.shortlist.map((entry) => {
          const isPlayed = entry.san === decision.san;
          return (
            <li
              key={entry.san}
              className="hover:bg-muted/60 grid grid-cols-[1.25rem_3.25rem_3.5rem_1fr_2.75rem] items-center gap-2 rounded-md px-1 py-0.5 text-sm"
            >
              <span className="text-muted-foreground tabular-nums">{entry.rank}</span>
              <span className={cn("truncate", isPlayed && "font-semibold")}>
                {entry.san}
                {isPlayed && <span className="sr-only"> (played)</span>}
              </span>
              <span className="text-right tabular-nums">
                <span className="sr-only">Stockfish </span>
                {formatScore(entry.score)}
              </span>
              <span className="flex h-2.5 items-center" aria-hidden="true">
                {entry.probability !== undefined && (
                  <span
                    className={cn("h-full rounded-r-[4px]", isPlayed ? "bg-chart-accent" : "bg-chart-muted")}
                    style={{ width: `${Math.max(2, (entry.probability / max) * 100)}%` }}
                  />
                )}
              </span>
              <span className="text-right tabular-nums">
                {entry.probability !== undefined && (
                  <>
                    <span className="sr-only">Jev </span>
                    {percent(entry.probability)}
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <span aria-hidden="true" className="bg-chart-accent inline-block h-2.5 w-3 rounded-r-[4px]" />
        Move played. Scores are from White&apos;s side.
      </p>
    </div>
  );
}
