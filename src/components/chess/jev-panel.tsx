"use client";

import { AlertTriangleIcon, LoaderCircleIcon, RotateCwIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { JevDecision } from "@/hooks/use-jev-opponent";
import { COLOR_NAME, type Color } from "@/lib/chess/game";
import {
  difficultyLabel,
  personalityLabel,
  type DifficultyId,
  type JevSource,
  type MoveProbability,
  type PersonalityId,
} from "@/lib/jev/types";
import { cn } from "@/lib/utils";

const SOURCE_BADGE: Record<JevSource, { label: string; className: string; title: string }> = {
  jev: { label: "Live", className: "", title: "Answered by the Jev API" },
  mock: {
    label: "Mock",
    className: "border-amber-500/60 text-amber-700 dark:text-amber-400",
    title: "No API key is set, so a local stand-in answered",
  },
  fallback: {
    label: "Fallback",
    className: "border-destructive/60 text-destructive",
    title: "Jev failed, so a simple local engine chose the move",
  },
};

type JevPanelProps = {
  jevColor: Color;
  personality: PersonalityId;
  difficulty: DifficultyId;
  thinking: boolean;
  error: string | null;
  decision: JevDecision | null;
  gameOver: boolean;
  onRetry: () => void;
};

const percent = (value: number) => `${Math.round(value * 100)}%`;

export function JevPanel({
  jevColor,
  personality,
  difficulty,
  thinking,
  error,
  decision,
  gameOver,
  onRetry,
}: JevPanelProps) {
  return (
    <Card className="gap-3" data-testid="jev-panel">
      <CardHeader className="gap-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Jev</CardTitle>
          {decision && (
            <Badge
              variant="outline"
              title={SOURCE_BADGE[decision.source].title}
              className={SOURCE_BADGE[decision.source].className}
              data-testid="jev-source"
            >
              {SOURCE_BADGE[decision.source].label}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Plays {COLOR_NAME[jevColor]}</Badge>
          <Badge variant="secondary">{personalityLabel(personality)}</Badge>
          <Badge variant="secondary">{difficultyLabel(difficulty)}</Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div aria-live="polite" data-testid="jev-state">
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

        {decision && <DecisionDetails decision={decision} difficulty={difficulty} />}
      </CardContent>
    </Card>
  );
}

function DecisionDetails({ decision, difficulty }: { decision: JevDecision; difficulty: DifficultyId }) {
  if (decision.source === "fallback") {
    return (
      <div className="flex flex-col gap-1" data-testid="jev-decision">
        <p className="text-sm">
          Played <span className="font-semibold">{decision.san}</span>
        </p>
        <p className="text-muted-foreground text-xs">
          {decision.fallbackReason} A simple local engine chose this move instead.
        </p>
      </div>
    );
  }

  const top = decision.topChoice;
  const differs = top && top.san !== decision.san;

  return (
    <div className="flex flex-col gap-4" data-testid="jev-decision">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs">Played</p>
          <p className="text-2xl font-semibold" data-testid="jev-played">
            {decision.san}
          </p>
        </div>
        {decision.confidence !== undefined && (
          <div className="text-right">
            <p className="text-muted-foreground text-xs">Confidence</p>
            <p className="text-2xl font-semibold tabular-nums" data-testid="jev-confidence">
              {percent(decision.confidence)}
            </p>
          </div>
        )}
      </div>

      {differs && (
        <p className="text-muted-foreground text-xs">
          Jev&apos;s top choice was {top.san} ({percent(top.probability)}). {difficultyLabel(difficulty)} difficulty
          played another of its ideas.
        </p>
      )}

      {decision.alternatives.length > 0 && (
        <CandidateChart candidates={decision.alternatives} played={decision.san} />
      )}

      {decision.source === "mock" && (
        <p className="text-muted-foreground text-xs">
          Mock mode: no Jev API key is set, so a local stand-in is answering in Jev&apos;s format.
        </p>
      )}
      <p className="text-muted-foreground text-xs tabular-nums">
        {decision.model ? `${decision.model} · ` : ""}
        {decision.latencyMs} ms
      </p>
    </div>
  );
}

/**
 * Jev's leading candidates as horizontal bars. The move played gets the accent
 * colour and a text tag. Every row shows its move and value, so the list is
 * also its own table view.
 */
function CandidateChart({ candidates, played }: { candidates: MoveProbability[]; played: string }) {
  const max = Math.max(...candidates.map((candidate) => candidate.probability), 0.0001);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-xs" id="jev-candidates-title">
        Jev&apos;s top candidates
      </p>
      <ol aria-labelledby="jev-candidates-title" className="flex flex-col gap-1" data-testid="jev-candidates">
        {candidates.map((candidate) => {
          const isPlayed = candidate.san === played;
          return (
            <li
              key={candidate.san}
              className="hover:bg-muted/60 grid grid-cols-[3.5rem_1fr_2.75rem] items-center gap-2 rounded-md px-1 py-0.5 text-sm"
            >
              <span className={cn("truncate", isPlayed && "font-semibold")}>
                {candidate.san}
                {isPlayed && <span className="sr-only"> (played)</span>}
              </span>
              <span className="flex h-2.5 items-center" aria-hidden="true">
                <span
                  className={cn(
                    "h-full rounded-r-[4px]",
                    isPlayed ? "bg-chart-accent" : "bg-chart-muted",
                  )}
                  style={{ width: `${Math.max(2, (candidate.probability / max) * 100)}%` }}
                />
              </span>
              <span className="text-right tabular-nums">{percent(candidate.probability)}</span>
            </li>
          );
        })}
      </ol>
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <span aria-hidden="true" className="bg-chart-accent inline-block h-2.5 w-3 rounded-r-[4px]" />
        Move played
      </p>
    </div>
  );
}
