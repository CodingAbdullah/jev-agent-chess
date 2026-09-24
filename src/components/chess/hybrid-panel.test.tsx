import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AiDecision } from "@/hooks/use-ai-opponent";
import type { HybridMove } from "@/lib/hybrid";
import { HybridPanel } from "./hybrid-panel";

const base = {
  aiColor: "b" as const,
  personality: "aggressive" as const,
  difficulty: "medium" as const,
  thinking: false,
  error: null,
  decision: null,
  gameOver: false,
  onRetry: () => {},
};

const decision: AiDecision<HybridMove> = {
  move: { from: "c7", to: "c5" },
  san: "c5",
  depth: 10,
  shortlist: [
    { san: "e5", rank: 1, score: { type: "cp", value: 30 }, probability: 0.3 },
    { san: "c5", rank: 2, score: { type: "cp", value: 35 }, probability: 0.6 },
    { san: "e6", rank: 3, score: { type: "cp", value: 45 }, probability: 0.1 },
  ],
  jev: {
    move: { from: "c7", to: "c5" },
    san: "c5",
    source: "mock",
    confidence: 0.6,
    topChoice: { san: "c5", probability: 0.6 },
    alternatives: [],
    latencyMs: 4,
  },
  gameId: 0,
  ply: 1,
};

describe("HybridPanel", () => {
  it("explains the setup", () => {
    render(<HybridPanel {...base} />);
    const panel = screen.getByTestId("hybrid-panel");
    expect(panel).toHaveTextContent("Plays Black");
    expect(panel).toHaveTextContent("Aggressive");
    expect(panel).toHaveTextContent("Stockfish shortlists its best moves at depth 10");
  });

  it("shows the shortlist with both views and marks the move played", () => {
    render(<HybridPanel {...base} decision={decision} />);
    expect(screen.getByTestId("hybrid-played")).toHaveTextContent("c5");
    expect(screen.getByTestId("hybrid-summary")).toHaveTextContent("Jev chose Stockfish's second choice.");
    expect(screen.getByTestId("hybrid-source")).toHaveTextContent("Mock");
    const rows = within(screen.getByTestId("hybrid-shortlist")).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent("2c5 (played)Stockfish +0.35Jev 60%");
  });

  it("explains a fallback and a forced move", () => {
    const { rerender } = render(
      <HybridPanel
        {...base}
        decision={{ ...decision, san: "e5", jev: { ...decision.jev!, source: "fallback", fallbackReason: "Jev did not answer in time." } }}
      />,
    );
    expect(screen.getByTestId("hybrid-summary")).toHaveTextContent(
      "Jev did not answer in time. Stockfish's top choice was played instead.",
    );
    rerender(<HybridPanel {...base} decision={{ ...decision, jev: null }} />);
    expect(screen.getByTestId("hybrid-summary")).toHaveTextContent("Stockfish saw only one sensible move");
  });
});
