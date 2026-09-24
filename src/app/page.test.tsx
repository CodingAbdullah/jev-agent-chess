import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home page", () => {
  it("shows the app title", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { level: 1, name: /jev chess/i }),
    ).toBeInTheDocument();
  });

  it("starts a two-player game with White to move", () => {
    render(<Home />);
    expect(screen.getByTestId("game-status")).toHaveTextContent("White to move.");
    expect(screen.getByText("2 Players")).toBeInTheDocument();
  });

  it("disables New game until a move is played", () => {
    render(<Home />);
    expect(screen.getByRole("button", { name: "New game" })).toBeDisabled();
  });
});
