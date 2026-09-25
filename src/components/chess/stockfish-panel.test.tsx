import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AiDecision } from "@/hooks/use-ai-opponent";
import type { StockfishMove } from "@/lib/stockfish/player";
import { EvalBar } from "./eval-bar";
import { StockfishPanel } from "./stockfish-panel";

const base = {
  stockfishColor: "b" as const,
  difficulty: "medium" as const,
  thinking: false,
  error: null,
  decision: null,
  gameOver: false,
  showAnalysis: true,
  onRetry: () => {},
};

const decision: AiDecision<StockfishMove> = {
  move: { from: "e7", to: "e5" },
  san: "e5",
  score: { type: "cp", value: 34 },
  depth: 8,
  line: ["e5", "Nf3", "Nc6"],
  difficulty: "medium",
  gameId: 0,
  ply: 1,
};

describe("StockfishPanel", () => {
  it("shows the setup and the engine limits", () => {
    render(<StockfishPanel {...base} />);
    const panel = screen.getByTestId("stockfish-panel");
    expect(panel).toHaveTextContent("Plays Black");
    expect(panel).toHaveTextContent("Medium");
    expect(panel).toHaveTextContent("Skill 8 · depth 8");
    expect(screen.getByTestId("stockfish-state")).toHaveTextContent("Waiting for your first move.");
  });

  it("shows the move, its evaluation and the expected line", () => {
    render(<StockfishPanel {...base} decision={decision} />);
    expect(screen.getByTestId("stockfish-played")).toHaveTextContent("e5");
    expect(screen.getByTestId("stockfish-score")).toHaveTextContent("+0.34");
    expect(screen.getByTestId("stockfish-line")).toHaveTextContent("e5 Nf3 Nc6");
    expect(screen.getByText(/White is slightly better, at depth 8/)).toBeInTheDocument();
  });

  it("keeps the evaluation and expected line hidden during play", () => {
    render(<StockfishPanel {...base} decision={decision} showAnalysis={false} />);
    expect(screen.getByTestId("stockfish-played")).toHaveTextContent("e5");
    expect(screen.queryByTestId("stockfish-score")).not.toBeInTheDocument();
    expect(screen.queryByTestId("stockfish-line")).not.toBeInTheDocument();
    expect(screen.getByTestId("stockfish-analysis-hidden")).toHaveTextContent(
      "Stockfish's evaluation and expected line appear when the game ends.",
    );
  });

  it("links to Stockfish's licence and source", () => {
    render(<StockfishPanel {...base} />);
    expect(screen.getByRole("link", { name: "GPL-3.0 licence" })).toHaveAttribute("href", "/stockfish/Copying.txt");
    expect(screen.getByRole("link", { name: "source code on GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/nmrugg/stockfish.js",
    );
  });
});

describe("EvalBar", () => {
  it("grows White's part from White's side of the board", () => {
    const { rerender } = render(<EvalBar whiteShare={0.8} label="Evaluation +3.00" orientation="white" />);
    const bar = screen.getByRole("img", { name: "Evaluation +3.00" });
    const fill = bar.firstElementChild as HTMLElement;
    expect(fill.style.height).toBe("80%");
    expect(fill.className).toContain("bottom-0");
    rerender(<EvalBar whiteShare={0.8} label="Evaluation +3.00" orientation="black" />);
    expect((screen.getByRole("img").firstElementChild as HTMLElement).className).toContain("top-0");
  });

  it("sits at the middle while the evaluation is unknown", () => {
    render(<EvalBar whiteShare={null} label="Analysing" orientation="white" />);
    expect((screen.getByRole("img").firstElementChild as HTMLElement).style.height).toBe("50%");
  });
});
