import { render, screen, waitFor, within } from "@testing-library/react";
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

  it("starts a game against Jev by default, with you as White", () => {
    renderApp();
    expect(screen.getByTestId("game-mode")).toHaveTextContent("vs Jev");
    expect(screen.getByTestId("player-w")).toHaveTextContent("You");
    expect(screen.getByTestId("player-b")).toHaveTextContent("Jev");
    expect(screen.getByTestId("jev-state")).toHaveTextContent("Waiting for your first move.");
    expect(screen.getByTestId("jev-panel")).toHaveTextContent("Balanced");
    expect(screen.getByTestId("jev-panel")).toHaveTextContent("Medium");
  });

  it("starts a two-player game with White to move and the default clock", () => {
    window.localStorage.setItem("jev-chess:settings", JSON.stringify({ mode: "local" }));
    renderApp();
    expect(screen.getByTestId("game-status")).toHaveTextContent("White to move.");
    expect(screen.getByTestId("game-mode")).toHaveTextContent("2 Players");
    expect(screen.queryByTestId("jev-panel")).not.toBeInTheDocument();
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

  it("hides the evaluation during games against the computer", () => {
    renderApp();
    expect(screen.queryByTestId("eval-bar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("evaluation")).not.toBeInTheDocument();
  });

  it("shows the evaluation against the computer when that setting is on", () => {
    window.localStorage.setItem("jev-chess:settings", JSON.stringify({ evaluationInComputerGames: true }));
    renderApp();
    expect(screen.getByTestId("eval-bar")).toBeInTheDocument();
  });

  it("explains that the evaluation is unavailable without Web Workers", async () => {
    window.localStorage.setItem("jev-chess:settings", JSON.stringify({ mode: "local" }));
    renderApp();
    expect(screen.getByTestId("eval-bar")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("evaluation")).toHaveTextContent("unavailable"));
  });

  it("hides the evaluation when it is turned off", () => {
    window.localStorage.setItem("jev-chess:settings", JSON.stringify({ mode: "local", showEvaluation: false }));
    renderApp();
    expect(screen.queryByTestId("eval-bar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("evaluation")).not.toBeInTheDocument();
  });

  it("shows the Stockfish panel in Stockfish games", () => {
    window.localStorage.setItem("jev-chess:settings", JSON.stringify({ mode: "stockfish", playerColor: "w" }));
    renderApp();
    expect(screen.getByTestId("game-mode")).toHaveTextContent("vs Stockfish");
    expect(screen.getByTestId("player-b")).toHaveTextContent("Stockfish");
    expect(screen.getByTestId("stockfish-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("jev-panel")).not.toBeInTheDocument();
  });
});
