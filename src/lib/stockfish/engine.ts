import { parseBestMove, parseInfo, type InfoLine } from "./uci";

/** The engine build served from public/stockfish by scripts/copy-stockfish.mjs. */
export const ENGINE_URL = "/stockfish/stockfish-19-lite-single.js";

/** The parts of a Worker the engine uses, so tests can supply a fake. */
export type EngineWorker = {
  postMessage(message: string): void;
  terminate(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
};

export type SearchOptions = {
  depth: number;
  movetimeMs: number;
  /** 0 to 20. Lower levels choose weaker moves on purpose. */
  skill?: number;
  multipv?: number;
  signal?: AbortSignal;
  /** Called with each improving line while the search runs. */
  onInfo?: (line: InfoLine) => void;
};

export type SearchResult = {
  bestMove: string | null;
  /** The deepest line seen for each MultiPV slot, best first. */
  lines: InfoLine[];
};

export class EngineUnavailableError extends Error {
  constructor(message = "The Stockfish engine could not be started in this browser.") {
    super(message);
    this.name = "EngineUnavailableError";
  }
}

export function canRunEngine(): boolean {
  return typeof Worker !== "undefined" && typeof WebAssembly !== "undefined";
}

const abortError = () => new DOMException("The search was cancelled.", "AbortError");

/**
 * A Stockfish engine running in a Web Worker. Searches run one at a time; a
 * new search waits for the previous one to finish, and cancelling a search
 * sends `stop` and waits for the engine's `bestmove` so it stays in sync.
 */
export class StockfishEngine {
  private worker: EngineWorker;
  private listener: ((line: string) => void) | null = null;
  private failure: Error | null = null;
  private ready: Promise<void>;
  private queue: Promise<unknown> = Promise.resolve();
  private currentSkill: number | null = null;
  private currentMultiPv: number | null = null;

  constructor(createWorker: () => EngineWorker = () => new Worker(ENGINE_URL) as unknown as EngineWorker) {
    this.worker = createWorker();
    this.worker.onmessage = (event) => {
      if (typeof event.data === "string") this.listener?.(event.data);
    };
    this.worker.onerror = () => {
      this.failure = new EngineUnavailableError();
      this.listener?.("__error__");
    };
    this.ready = this.handshake();
  }

  private waitFor(predicate: (line: string) => boolean, send: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.failure) return reject(this.failure);
      this.listener = (line) => {
        if (line === "__error__") return reject(this.failure);
        if (predicate(line)) {
          this.listener = null;
          resolve();
        }
      };
      for (const command of send) this.worker.postMessage(command);
    });
  }

  private async handshake() {
    await this.waitFor((line) => line === "uciok", ["uci"]);
    await this.waitFor((line) => line === "readyok", ["isready"]);
  }

  /** Search a position. Rejects with an AbortError if `signal` fires first. */
  search(fen: string, options: SearchOptions): Promise<SearchResult> {
    const run = this.queue.then(() => this.runSearch(fen, options));
    // Keep the queue alive whether this search succeeds or fails.
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async runSearch(fen: string, options: SearchOptions): Promise<SearchResult> {
    const { depth, movetimeMs, skill = 20, multipv = 1, signal, onInfo } = options;
    if (signal?.aborted) throw abortError();
    await this.ready;
    if (signal?.aborted) throw abortError();

    const setup: string[] = [];
    if (skill !== this.currentSkill) setup.push(`setoption name Skill Level value ${skill}`);
    if (multipv !== this.currentMultiPv) setup.push(`setoption name MultiPV value ${multipv}`);
    this.currentSkill = skill;
    this.currentMultiPv = multipv;
    if (setup.length) await this.waitFor((line) => line === "readyok", [...setup, "isready"]);
    if (signal?.aborted) throw abortError();

    const lines = new Map<number, InfoLine>();
    return new Promise<SearchResult>((resolve, reject) => {
      if (this.failure) return reject(this.failure);
      const onAbort = () => this.worker.postMessage("stop");
      signal?.addEventListener("abort", onAbort, { once: true });

      this.listener = (line) => {
        if (line === "__error__") {
          signal?.removeEventListener("abort", onAbort);
          return reject(this.failure);
        }
        const info = parseInfo(line);
        if (info) {
          const previous = lines.get(info.multipv);
          if (!previous || info.depth >= previous.depth) {
            lines.set(info.multipv, info);
            onInfo?.(info);
          }
          return;
        }
        const best = parseBestMove(line);
        if (best) {
          this.listener = null;
          signal?.removeEventListener("abort", onAbort);
          if (signal?.aborted) return reject(abortError());
          resolve({
            bestMove: best.best,
            lines: [...lines.values()].sort((a, b) => a.multipv - b.multipv),
          });
        }
      };

      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(`go depth ${depth} movetime ${movetimeMs}`);
    });
  }

  /** Shut the worker down. Any search still running is rejected. */
  terminate() {
    this.failure = new EngineUnavailableError("The Stockfish engine was shut down.");
    this.listener?.("__error__");
    this.listener = null;
    this.worker.terminate();
  }
}
