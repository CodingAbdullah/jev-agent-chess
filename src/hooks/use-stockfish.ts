"use client";

import { Chess } from "chess.js";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  canRunEngine,
  EngineUnavailableError,
  StockfishEngine,
} from "@/lib/stockfish/engine";
import { ANALYSIS_LIMITS, toWhitePerspective, type Score } from "@/lib/stockfish/uci";

/**
 * Owns one Stockfish worker while `active` is true. The worker starts on first
 * use and is shut down when `active` turns false or the component unmounts.
 */
export function useStockfishEngine(active: boolean) {
  const engine = useRef<StockfishEngine | null>(null);

  useEffect(() => {
    if (!active) return;
    return () => {
      engine.current?.terminate();
      engine.current = null;
    };
  }, [active]);

  return useCallback((): StockfishEngine => {
    if (!canRunEngine()) throw new EngineUnavailableError();
    engine.current ??= new StockfishEngine();
    return engine.current;
  }, []);
}

export type Evaluation =
  | { status: "off" }
  | { status: "analysing"; score: Score | null; depth: number }
  | { status: "error"; message: string };

/** Delay before analysing, so quick move sequences do not start many searches. */
const ANALYSIS_DELAY_MS = 150;

/**
 * Evaluates the current position with its own Stockfish worker, for the
 * evaluation bar. Results stream in as the search deepens.
 */
export function useEvaluation({ enabled, fen, gameOver }: { enabled: boolean; fen: string; gameOver: boolean }) {
  const active = enabled && !gameOver;
  const getEngine = useStockfishEngine(enabled);
  const [result, setResult] = useState<{ fen: string; evaluation: Evaluation } | null>(null);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const turn = new Chess(fen).turn();
    const timer = setTimeout(() => {
      let engine: StockfishEngine;
      try {
        engine = getEngine();
      } catch (error) {
        setResult({ fen, evaluation: { status: "error", message: (error as Error).message } });
        return;
      }
      engine
        .search(fen, {
          ...ANALYSIS_LIMITS,
          signal: controller.signal,
          onInfo: (line) => {
            if (line.multipv !== 1 || controller.signal.aborted) return;
            setResult({
              fen,
              evaluation: { status: "analysing", score: toWhitePerspective(line.score, turn), depth: line.depth },
            });
          },
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          const message = error instanceof Error ? error.message : "The position could not be analysed.";
          setResult({ fen, evaluation: { status: "error", message } });
        });
    }, ANALYSIS_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [active, fen, getEngine]);

  if (!enabled) return { status: "off" } as const;
  if (result?.fen === fen) return result.evaluation;
  return { status: "analysing", score: null, depth: 0 } as const;
}
