import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { JevDecision } from "@/hooks/use-jev-opponent";
import { JevPanel } from "./jev-panel";

const base = {
  jevColor: "b" as const,
  personality: "aggressive" as const,
  difficulty: "easy" as const,
  thinking: false,
  error: null,
  decision: null,
  gameOver: false,
  onRetry: () => {},
};

const decision: JevDecision = {
  move: { from: "g8", to: "f6" },
  san: "Nf6",
  source: "jev",
  topChoice: { san: "e5", probability: 0.62 },
  confidence: 0.62,
  alternatives: [
    { san: "e5", probability: 0.62 },
    { san: "Nf6", probability: 0.21 },
    { san: "d5", probability: 0.1 },
  ],
  model: "jev-latest",
  latencyMs: 142,
  gameId: 0,
  ply: 1,
};

describe("JevPanel", () => {
  it("shows the setup and waits for the first move", () => {
    render(<JevPanel {...base} />);
    const panel = screen.getByTestId("jev-panel");
    expect(panel).toHaveTextContent("Plays Black");
    expect(panel).toHaveTextContent("Aggressive");
    expect(panel).toHaveTextContent("Easy");
    expect(screen.getByTestId("jev-state")).toHaveTextContent("Waiting for your first move.");
  });

  it("shows when Jev is thinking", () => {
    render(<JevPanel {...base} thinking />);
    expect(screen.getByTestId("jev-state")).toHaveTextContent("Thinking…");
  });

  it("shows the move, confidence and candidates, marking the move played", () => {
    render(<JevPanel {...base} decision={decision} />);
    expect(screen.getByTestId("jev-played")).toHaveTextContent("Nf6");
    expect(screen.getByTestId("jev-confidence")).toHaveTextContent("62%");
    expect(screen.getByTestId("jev-source")).toHaveTextContent("Live");
    expect(screen.getByText(/top choice was e5 \(62%\)/)).toBeInTheDocument();
    const rows = within(screen.getByTestId("jev-candidates")).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent("Nf6 (played)21%");
    expect(screen.getByText("jev-latest · 142 ms")).toBeInTheDocument();
  });

  it("explains a fallback move", () => {
    render(
      <JevPanel
        {...base}
        decision={{ ...decision, source: "fallback", alternatives: [], topChoice: undefined, confidence: undefined, fallbackReason: "Jev did not answer in time." }}
      />,
    );
    expect(screen.getByTestId("jev-source")).toHaveTextContent("Fallback");
    expect(screen.getByTestId("jev-decision")).toHaveTextContent(
      "Jev did not answer in time. A simple local engine chose this move instead.",
    );
    expect(screen.queryByTestId("jev-candidates")).not.toBeInTheDocument();
  });

  it("labels mock answers", () => {
    render(<JevPanel {...base} decision={{ ...decision, source: "mock" }} />);
    expect(screen.getByTestId("jev-source")).toHaveTextContent("Mock");
    expect(screen.getByText(/no Jev API key is set/)).toBeInTheDocument();
  });

  it("offers a retry after an error", () => {
    const onRetry = vi.fn();
    render(<JevPanel {...base} error="The server returned HTTP 500." onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("The server returned HTTP 500.");
    screen.getByRole("button", { name: "Try again" }).click();
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
