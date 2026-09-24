import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Providers } from "@/components/providers";
import { ChessApp } from "./chess-app";

const renderApp = () => render(<ChessApp />, { wrapper: Providers });

describe("ChessApp", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows the app title", () => {
    renderApp();
    expect(screen.getByRole("heading", { level: 1, name: /jev chess/i })).toBeInTheDocument();
  });

  it("starts a two-player game with White to move and the default clock", () => {
    renderApp();
    expect(screen.getByTestId("game-status")).toHaveTextContent("White to move.");
    expect(screen.getByText("2 Players")).toBeInTheDocument();
    expect(screen.getByTestId("time-control")).toHaveTextContent("10 min");
    expect(screen.getByRole("timer", { name: "White clock" })).toHaveTextContent("10:00");
    expect(screen.getByRole("timer", { name: "Black clock" })).toHaveTextContent("10:00");
  });

  it("uses the saved time control for the first game", () => {
    window.localStorage.setItem("jev-chess:settings", JSON.stringify({ timeControl: "3+2" }));
    renderApp();
    expect(screen.getByTestId("time-control")).toHaveTextContent("3 | 2");
    expect(screen.getByRole("timer", { name: "White clock" })).toHaveTextContent("3:00");
  });

  it("shows no clocks in unlimited games", () => {
    window.localStorage.setItem("jev-chess:settings", JSON.stringify({ timeControl: "unlimited" }));
    renderApp();
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  });

  it("disables undo before any move and shows an empty move list", () => {
    renderApp();
    const toolbar = screen.getByRole("toolbar", { name: "Game controls" });
    expect(within(toolbar).getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(screen.getByText("No moves yet.")).toBeInTheDocument();
  });
});
