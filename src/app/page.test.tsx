import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home page", () => {
  it("shows the app title", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { level: 1, name: /jev chess/i }),
    ).toBeInTheDocument();
  });

  it("lists every planned game mode", () => {
    render(<Home />);
    const modes = within(screen.getByRole("list", { name: "Game modes" }));
    for (const mode of ["vs Jev", "vs Stockfish", "Hybrid", "2 Players"]) {
      expect(modes.getByText(mode)).toBeInTheDocument();
    }
  });
});
