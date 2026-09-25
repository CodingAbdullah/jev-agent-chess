import { describe, expect, it } from "vitest";
import { StockfishEngine, type EngineWorker } from "./engine";
import {
  describeScore,
  formatScore,
  parseBestMove,
  parseInfo,
  pvToSan,
  toWhitePerspective,
  uciToMoveInput,
  whiteShare,
} from "./uci";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("parseInfo", () => {
  it("reads depth, MultiPV slot, score and line", () => {
    const line =
      "info depth 12 seldepth 14 multipv 2 score cp -34 nodes 108576 nps 505004 time 215 pv c7c5 g1f3 e7e6";
    expect(parseInfo(line)).toEqual({
      depth: 12,
      multipv: 2,
      score: { type: "cp", value: -34 },
      pv: ["c7c5", "g1f3", "e7e6"],
    });
  });

  it("reads mate scores and defaults the slot to 1", () => {
    expect(parseInfo("info depth 5 score mate -2 nodes 10 pv e1f1 d8h4")).toMatchObject({
      multipv: 1,
      score: { type: "mate", value: -2 },
    });
  });

  it("reads bound scores", () => {
    expect(parseInfo("info depth 9 multipv 1 score cp 41 lowerbound nodes 5 pv e2e4")?.score).toEqual({
      type: "cp",
      value: 41,
    });
  });

  it("ignores lines without a score and line", () => {
    expect(parseInfo("info string NNUE evaluation using nn-37f18f62d772.nnue")).toBeNull();
    expect(parseInfo("info depth 3 currmove e2e4 currmovenumber 1")).toBeNull();
    expect(parseInfo("uciok")).toBeNull();
  });
});

describe("parseBestMove", () => {
  it("reads the best move, or null when there is none", () => {
    expect(parseBestMove("bestmove e7e6 ponder b1c3")).toEqual({ best: "e7e6" });
    expect(parseBestMove("bestmove (none)")).toEqual({ best: null });
    expect(parseBestMove("info depth 1")).toBeNull();
  });
});

describe("moves and scores", () => {
  it("turns UCI moves into move inputs, including promotion", () => {
    expect(uciToMoveInput("e2e4")).toEqual({ from: "e2", to: "e4" });
    expect(uciToMoveInput("a7a8q")).toEqual({ from: "a7", to: "a8", promotion: "q" });
  });

  it("flips scores to White's point of view", () => {
    expect(toWhitePerspective({ type: "cp", value: 30 }, "b")).toEqual({ type: "cp", value: -30 });
    expect(toWhitePerspective({ type: "mate", value: 2 }, "w")).toEqual({ type: "mate", value: 2 });
  });

  it.each([
    [{ type: "cp", value: 25 }, "+0.25"],
    [{ type: "cp", value: -130 }, "-1.30"],
    [{ type: "cp", value: 0 }, "0.00"],
    [{ type: "mate", value: 3 }, "M3"],
    [{ type: "mate", value: -2 }, "-M2"],
  ] as const)("formats %j as %s", (score, text) => {
    expect(formatScore(score)).toBe(text);
  });

  it("maps scores to the bar, with mate at the ends", () => {
    expect(whiteShare({ type: "cp", value: 0 })).toBeCloseTo(0.5);
    expect(whiteShare({ type: "cp", value: 300 })).toBeGreaterThan(0.7);
    expect(whiteShare({ type: "cp", value: -300 })).toBeLessThan(0.3);
    expect(whiteShare({ type: "mate", value: 4 })).toBe(1);
    expect(whiteShare({ type: "mate", value: -1 })).toBe(0);
  });

  it("describes scores in words", () => {
    expect(describeScore({ type: "cp", value: 12 })).toBe("The position is about equal");
    expect(describeScore({ type: "cp", value: -60 })).toBe("Black is slightly better");
    expect(describeScore({ type: "cp", value: 450 })).toBe("White is winning");
    expect(describeScore({ type: "mate", value: 2 })).toBe("White mates in 2");
  });

  it("converts a principal variation to SAN and stops at an illegal move", () => {
    expect(pvToSan(START, ["e2e4", "e7e5", "g1f3"])).toEqual(["e4", "e5", "Nf3"]);
    expect(pvToSan(START, ["e2e4", "e2e4", "g1f3"])).toEqual(["e4"]);
  });
});

/** A fake engine worker that answers commands with scripted output. */
function fakeWorker(script: (command: string, emit: (line: string) => void) => void) {
  const sent: string[] = [];
  const worker: EngineWorker & { sent: string[] } = {
    sent,
    onmessage: null,
    onerror: null,
    postMessage(command) {
      sent.push(command);
      const emit = (line: string) => queueMicrotask(() => worker.onmessage?.({ data: line }));
      script(command, emit);
    },
    terminate() {},
  };
  return worker;
}

const standardScript = (command: string, emit: (line: string) => void) => {
  if (command === "uci") emit("uciok");
  if (command === "isready") emit("readyok");
  if (command.startsWith("go")) {
    emit("info depth 1 multipv 1 score cp 20 nodes 20 pv e2e4");
    emit("info depth 2 multipv 1 score cp 31 nodes 90 pv d2d4 d7d5");
    emit("info depth 2 multipv 2 score cp 12 nodes 90 pv e2e4 e7e5");
    emit("bestmove d2d4 ponder d7d5");
  }
};

describe("StockfishEngine", () => {
  it("handshakes, sets options, searches and keeps the deepest line per slot", async () => {
    const worker = fakeWorker(standardScript);
    const engine = new StockfishEngine(() => worker);
    const seen: number[] = [];
    const result = await engine.search(START, {
      depth: 8,
      movetimeMs: 500,
      skill: 5,
      multipv: 2,
      onInfo: (line) => seen.push(line.depth),
    });
    expect(result.bestMove).toBe("d2d4");
    expect(result.lines.map((line) => [line.multipv, line.depth, line.pv[0]])).toEqual([
      [1, 2, "d2d4"],
      [2, 2, "e2e4"],
    ]);
    expect(seen).toEqual([1, 2, 2]);
    expect(worker.sent).toEqual([
      "uci",
      "isready",
      "setoption name Skill Level value 5",
      "setoption name MultiPV value 2",
      "isready",
      `position fen ${START}`,
      "go depth 8 movetime 500",
    ]);
  });

  it("does not resend options that have not changed", async () => {
    const worker = fakeWorker(standardScript);
    const engine = new StockfishEngine(() => worker);
    await engine.search(START, { depth: 4, movetimeMs: 100 });
    worker.sent.length = 0;
    await engine.search(START, { depth: 4, movetimeMs: 100 });
    expect(worker.sent).toEqual([`position fen ${START}`, "go depth 4 movetime 100"]);
  });

  it("runs searches one at a time", async () => {
    const worker = fakeWorker(standardScript);
    const engine = new StockfishEngine(() => worker);
    const [first, second] = await Promise.all([
      engine.search(START, { depth: 4, movetimeMs: 100 }),
      engine.search(START, { depth: 6, movetimeMs: 100 }),
    ]);
    expect(first.bestMove).toBe("d2d4");
    expect(second.bestMove).toBe("d2d4");
    const goes = worker.sent.filter((command) => command.startsWith("go"));
    expect(goes).toEqual(["go depth 4 movetime 100", "go depth 6 movetime 100"]);
  });

  it("stops a cancelled search and rejects with AbortError", async () => {
    let finish: (() => void) | null = null;
    const worker = fakeWorker((command, emit) => {
      if (command === "uci") emit("uciok");
      if (command === "isready") emit("readyok");
      if (command.startsWith("go")) finish = () => emit("bestmove e2e4");
      if (command === "stop") finish?.();
    });
    const engine = new StockfishEngine(() => worker);
    const controller = new AbortController();
    const search = engine.search(START, { depth: 30, movetimeMs: 60_000, signal: controller.signal });
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();
    await expect(search).rejects.toMatchObject({ name: "AbortError" });
    expect(worker.sent).toContain("stop");
  });

  it("rejects when the worker fails to load", async () => {
    const worker = fakeWorker(() => {});
    const engine = new StockfishEngine(() => worker);
    const search = engine.search(START, { depth: 4, movetimeMs: 100 });
    worker.onerror?.(new Event("error"));
    await expect(search).rejects.toMatchObject({ name: "EngineUnavailableError" });
  });

  it("rejects a running search when shut down", async () => {
    const worker = fakeWorker((command, emit) => {
      if (command === "uci") emit("uciok");
      if (command === "isready") emit("readyok");
    });
    const engine = new StockfishEngine(() => worker);
    const search = engine.search(START, { depth: 30, movetimeMs: 60_000 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    engine.terminate();
    await expect(search).rejects.toThrow("The Stockfish engine was shut down.");
  });
});
