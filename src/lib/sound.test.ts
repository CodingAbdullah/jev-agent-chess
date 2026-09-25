import { describe, expect, it } from "vitest";
import { replay } from "./chess/game";
import { playSound, soundForMove } from "./sound";

const lastMove = (...moves: [string, string][]) =>
  replay(moves.map(([from, to]) => ({ from, to }) as never)).history({ verbose: true }).at(-1)!;

describe("soundForMove", () => {
  it("picks a sound from what the move did", () => {
    expect(soundForMove(lastMove(["e2", "e4"]))).toBe("move");
    expect(soundForMove(lastMove(["e2", "e4"], ["d7", "d5"], ["e4", "d5"]))).toBe("capture");
    expect(soundForMove(lastMove(["e2", "e4"], ["f7", "f6"], ["d1", "h5"]))).toBe("check");
    expect(
      soundForMove(lastMove(["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"])),
    ).toBe("gameEnd");
    expect(
      soundForMove(
        lastMove(["e2", "e4"], ["e7", "e5"], ["g1", "f3"], ["b8", "c6"], ["f1", "c4"], ["g8", "f6"], ["e1", "g1"]),
      ),
    ).toBe("castle");
  });
});

describe("playSound", () => {
  it("does nothing where Web Audio is unavailable", () => {
    expect(() => playSound("move")).not.toThrow();
  });
});
