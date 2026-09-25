"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { requestJevEvaluation } from "@/lib/jev/api";
import type { JevEvaluation } from "@/lib/jev/types";

export type JevEvaluationState =
  | { status: "off" }
  | { status: "loading" }
  | { status: "ready"; evaluation: JevEvaluation }
  | { status: "error"; message: string };

type Result = { evaluation: JevEvaluation } | { error: string };

/** Wait for the position to settle, so stepping through a game asks Jev only where it stops. */
const EVALUATION_DELAY_MS = 400;

/**
 * Jev's view of the position, from the server. Answers are kept per position,
 * so stepping back and forth through a game asks Jev about each position once.
 */
export function useJevEvaluation({ enabled, fen, history }: { enabled: boolean; fen: string; history: string[] }) {
  const [results, setResults] = useState<ReadonlyMap<string, Result>>(new Map());
  const known = useEffectEvent((position: string) => {
    const result = results.get(position);
    return result !== undefined && "evaluation" in result;
  });
  const recentMoves = useEffectEvent(() => history);

  useEffect(() => {
    if (!enabled || known(fen)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      requestJevEvaluation({ fen, history: recentMoves() }, controller.signal)
        .then((evaluation) => setResults((map) => new Map(map).set(fen, { evaluation })))
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          const message = error instanceof Error ? error.message : "Jev could not judge this position.";
          setResults((map) => new Map(map).set(fen, { error: message }));
        });
    }, EVALUATION_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, fen]);

  if (!enabled) return { status: "off" } as const satisfies JevEvaluationState;
  const result = results.get(fen);
  if (!result) return { status: "loading" } as const satisfies JevEvaluationState;
  return ("evaluation" in result
    ? { status: "ready", evaluation: result.evaluation }
    : { status: "error", message: result.error }) satisfies JevEvaluationState;
}
