// @vitest-environment node
/**
 * Live checks against the real Jev API. Run with `npm run jev:live`, which
 * reads TYPESAFE_API_KEY from .env.local. Skipped in `npm test` unless
 * JEV_LIVE=1 is set, so the normal run never needs a key or network.
 */
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { decideMove } from "./decide";
import { PERSONALITIES, type PersonalityId } from "./types";

const requested = process.env.JEV_LIVE === "1" || process.env.npm_lifecycle_event === "jev:live";
const live = requested && Boolean(process.env.TYPESAFE_API_KEY?.trim());

it.runIf(requested && !live)("has an API key", () => {
  throw new Error("TYPESAFE_API_KEY is not set. Add it to .env.local or the environment first.");
});

/** Positions with one clearly right move. */
const PUZZLES: { name: string; fen: string; best: string[] }[] = [
  { name: "back-rank mate for White", fen: "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", best: ["Ra8#"] },
  { name: "back-rank mate for Black", fen: "r5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1", best: ["Ra1#"] },
  {
    name: "take the hanging queen",
    fen: "rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
    best: ["Nxh4"],
  },
  {
    name: "scholar's mate",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
    best: ["Qxf7#"],
  },
  {
    name: "recapture the queen",
    fen: "rnb1kbnr/ppp2ppp/8/3p4/8/8/PPPPqPPP/RNBQKBNR w KQkq - 0 4",
    best: ["Qxe2", "Bxe2", "Nxe2", "Kxe2"],
  },
];

describe.skipIf(!live)("live Jev", () => {
  // Built only when the suite runs; the constructor throws without a key.
  const client = live
    ? new TypeSafeClient({ timeout: 20_000, retry: { maxRetries: 1 }, logLevel: "off" })
    : (null as never);

  it.each(PUZZLES)("finds the move: $name", async ({ fen, best }) => {
    const personality: PersonalityId = "balanced";
    const decision = await decideMove({
      client,
      mode: "live",
      request: { fen, history: [], personality, difficulty: "hard" },
      log: () => {},
    });
    const top = decision.alternatives.slice(0, 3).map((m) => `${m.san} ${(m.probability * 100).toFixed(0)}%`);
    console.log(`${fen}\n  played ${decision.san} (${decision.source}, ${decision.latencyMs} ms), top: ${top.join(", ")}`);
    expect(decision.source).toBe("jev");
    expect(new Chess(fen).move(decision.san)).toBeTruthy();
    expect(best).toContain(decision.san);
  }, 60_000);

  it("picks from Stockfish's shortlist in hybrid mode", async () => {
    // The starting position, with Stockfish's top five as the browser would send them.
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const candidates = [
      { uci: "e2e4", score: { type: "cp" as const, value: 35 }, line: ["e4", "e5", "Nf3"] },
      { uci: "d2d4", score: { type: "cp" as const, value: 32 }, line: ["d4", "Nf6", "c4"] },
      { uci: "g1f3", score: { type: "cp" as const, value: 28 }, line: ["Nf3", "d5", "d4"] },
      { uci: "c2c4", score: { type: "cp" as const, value: 25 }, line: ["c4", "e5", "Nc3"] },
      { uci: "g2g3", score: { type: "cp" as const, value: 15 }, line: ["g3", "d5", "Bg2"] },
    ];
    for (const personality of ["aggressive", "positional"] as const) {
      const decision = await decideMove({
        client,
        mode: "live",
        request: { fen, history: [], personality, difficulty: "hard", candidates },
        log: () => {},
      });
      const top = decision.alternatives.map((m) => `${m.san} ${(m.probability * 100).toFixed(0)}%`);
      console.log(`  hybrid ${personality}: played ${decision.san}, ${top.join(", ")}`);
      expect(decision.source).toBe("jev");
      expect(["e4", "d4", "Nf3", "c4", "g3"]).toContain(decision.san);
      expect(decision.alternatives.length).toBeGreaterThan(1);
    }
  }, 60_000);

  it("gives each personality its own view of a quiet position", async () => {
    // Italian Game after 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6.
    const fen = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R w KQkq - 1 5";
    const tops = new Map<string, string>();
    for (const personality of PERSONALITIES.map((option) => option.id)) {
      const decision = await decideMove({
        client,
        mode: "live",
        request: { fen, history: [], personality, difficulty: "hard" },
        log: () => {},
      });
      expect(decision.source).toBe("jev");
      const top = decision.alternatives.slice(0, 3).map((m) => `${m.san} ${(m.probability * 100).toFixed(0)}%`);
      console.log(`  ${personality}: ${top.join(", ")}`);
      tops.set(personality, top.join());
    }
    // Different wording should move the probabilities, not only the top move.
    expect(new Set(tops.values()).size).toBeGreaterThan(1);
  }, 120_000);
});
