"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChessGame, type MoveOutcome } from "@/hooks/use-chess-game";
import { useAiOpponent, type Think } from "@/hooks/use-ai-opponent";
import { useSettings } from "@/hooks/use-settings";
import { useEvaluation, useStockfishEngine, type Evaluation } from "@/hooks/use-stockfish";
import { findBoardTheme } from "@/lib/board-themes";
import { findTimeControl, TIME_CONTROLS } from "@/lib/chess/clock";
import {
  describeStatus,
  moveRows,
  opponent,
  toPgn,
  winsPhrase,
  type Color,
  type GameStatus,
  type LoadedGame,
  type MoveInput,
} from "@/lib/chess/game";
import {
  aiColor,
  aiName,
  aiSetupLabel,
  configFromSettings,
  isAiGame,
  modeLabel,
  pgnNames,
  playerNames,
  type GameConfig,
} from "@/lib/game-config";
import { requestJevMove } from "@/lib/jev/api";
import type { JevMoveResponse } from "@/lib/jev/types";
import { getSettings } from "@/lib/settings";
import { playSound, soundForMove } from "@/lib/sound";
import { stockfishMove, type StockfishMove } from "@/lib/stockfish/player";
import { describeScore, formatScore, whiteShare } from "@/lib/stockfish/uci";
import { cn } from "@/lib/utils";
import { EvalBar } from "./eval-bar";
import { GameBoard } from "./game-board";
import { GameOverDialog } from "./game-over-dialog";
import { GameToolbar } from "./game-toolbar";
import { ImportExportDialog, type ImportExportTab } from "./import-export-dialog";
import { JevPanel } from "./jev-panel";
import { MoveHistory } from "./move-history";
import { NewGameDialog, type GameSetup } from "./new-game-dialog";
import { PlayerBar } from "./player-bar";
import { SettingsDialog } from "./settings-dialog";
import { StockfishPanel } from "./stockfish-panel";

type OpenDialog = "new" | "settings" | "import-export" | null;

const orientationFor = (config: GameConfig) =>
  isAiGame(config) && config.humanColor === "b" ? "black" : "white";

export function ChessApp() {
  const [settings, updateSettings] = useSettings();
  // This component renders only in the browser, so saved settings are available on first render.
  const [initial] = useState(() => {
    const saved = getSettings();
    return { config: configFromSettings(saved), timeControl: findTimeControl(saved.timeControl).control };
  });
  const [config, setConfig] = useState<GameConfig>(initial.config);
  const game = useChessGame(initial.timeControl);
  const { chess, status, gameOver, clock } = game;
  const names = playerNames(config);

  const [orientation, setOrientation] = useState<"white" | "black">(() => orientationFor(initial.config));
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [importExportTab, setImportExportTab] = useState<ImportExportTab>("export");
  // The game-over dialog shows once per game end. Undo and replay produce a new revision.
  const gameEndKey = `${game.gameId}:${game.revision}`;
  const [dismissedGameEnd, setDismissedGameEnd] = useState<string | null>(null);
  const showGameOver = gameOver && dismissedGameEnd !== gameEndKey && dialog === null;

  const boardTheme = findBoardTheme(settings.boardTheme);
  const timeControlLabel =
    TIME_CONTROLS.find((option) => option.control === game.timeControl)?.label ??
    (game.timeControl ? "Custom" : "Unlimited");

  const rows = useMemo(() => moveRows(game.history), [game.history]);
  const pgn = useMemo(() => {
    const pgnPlayers = pgnNames(config);
    return toPgn({ startFen: game.startFen, moves: game.moves }, status, { white: pgnPlayers.w, black: pgnPlayers.b });
  }, [config, game.startFen, game.moves, status]);

  const soundOn = settings.sound;
  const announceMove = useCallback(
    (outcome: MoveOutcome) => {
      if (soundOn) playSound(soundForMove(outcome.move));
    },
    [soundOn],
  );

  const computerColor = aiColor(config);
  const humanColor = isAiGame(config) ? config.humanColor : null;

  const jevThink = useCallback<Think<JevMoveResponse>>(
    (position, signal) => {
      if (config.mode !== "jev") return Promise.reject(new Error("Jev is not playing this game."));
      return requestJevMove(
        { ...position, personality: config.personality, difficulty: config.difficulty },
        signal,
      );
    },
    [config],
  );
  const jev = useAiOpponent({
    color: config.mode === "jev" ? computerColor : null,
    game,
    think: jevThink,
    onMove: announceMove,
  });

  const getOpponentEngine = useStockfishEngine(config.mode === "stockfish");
  const stockfishThink = useCallback<Think<StockfishMove>>(
    async (position, signal) => {
      if (config.mode !== "stockfish") throw new Error("Stockfish is not playing this game.");
      return stockfishMove(getOpponentEngine(), position.fen, config.difficulty, signal);
    },
    [config, getOpponentEngine],
  );
  const stockfish = useAiOpponent({
    color: config.mode === "stockfish" ? computerColor : null,
    game,
    think: stockfishThink,
    onMove: announceMove,
  });

  const evaluation = useEvaluation({ enabled: settings.showEvaluation, fen: chess.fen(), gameOver });
  const evalDisplay = describeEvaluation(evaluation, status);

  const handleMove = useCallback(
    (input: MoveInput) => {
      const outcome = game.makeMove(input);
      if (outcome) announceMove(outcome);
      return outcome !== null;
    },
    [game, announceMove],
  );

  // Against Jev, undo takes back Jev's reply and your move, so it is your turn again.
  const pliesToUndo = useMemo(() => {
    if (!humanColor) return game.history.length > 0 ? 1 : 0;
    const lastHumanMove = game.history.findLastIndex((move) => move.color === humanColor);
    return lastHumanMove === -1 ? 0 : game.history.length - lastHumanMove;
  }, [game.history, humanColor]);

  const undo = () => {
    for (let i = 0; i < pliesToUndo; i++) game.undo();
  };

  const startGame = (setup: GameSetup) => {
    updateSettings(setup);
    const next = configFromSettings({ ...getSettings(), ...setup });
    setConfig(next);
    setOrientation(orientationFor(next));
    game.newGame(findTimeControl(setup.timeControl).control);
  };

  const rematch = () => {
    setDismissedGameEnd(gameEndKey);
    const next = configFromSettings(getSettings());
    setConfig(next);
    setOrientation(orientationFor(next));
    game.newGame(game.timeControl);
  };

  const importGame = (loaded: LoadedGame) => game.loadGame(loaded, game.timeControl);

  const openImportExport = (tab: ImportExportTab) => {
    setImportExportTab(tab);
    setDialog("import-export");
  };

  // A clock can run out without a move, so the timeout sound plays from here.
  const timeoutKey = isTimeoutEnd(status) ? gameEndKey : null;
  useEffect(() => {
    if (timeoutKey && soundOn) playSound("gameEnd");
  }, [timeoutKey, soundOn]);

  const bottomColor: Color = orientation === "white" ? "w" : "b";
  const topColor = opponent(bottomColor);
  const turn = chess.turn();
  const humansTurn = humanColor === null || turn === humanColor;
  const playerBar = (color: Color) => (
    <PlayerBar
      color={color}
      name={names[color]}
      captured={game.captured[color]}
      lead={color === "w" ? game.material : -game.material}
      clock={clock}
      turn={turn}
      active={!gameOver && turn === color}
    />
  );

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <h1 className="text-lg font-semibold tracking-tight">♟ Jev Chess</h1>
        <Button onClick={() => setDialog("new")}>New game</Button>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-4 p-4 sm:gap-6 sm:p-6 lg:grid-cols-[minmax(200px,260px)_minmax(0,640px)_minmax(240px,300px)] lg:items-start lg:justify-center">
        <section
          aria-label="Board"
          className="mx-auto flex w-full max-w-[640px] min-w-[280px] flex-col gap-2 lg:col-start-2 lg:row-start-1 lg:max-w-[min(640px,calc(100dvh_-_17rem))]"
        >
          {playerBar(topColor)}
          <div className="flex items-stretch gap-1.5 sm:gap-2">
            {settings.showEvaluation && (
              <EvalBar whiteShare={evalDisplay.share} label={evalDisplay.label} orientation={orientation} />
            )}
            <div className="min-w-0 flex-1">
              <GameBoard
                chess={chess}
                lastMove={game.history.at(-1) ?? null}
                interactive={!gameOver && humansTurn}
                orientation={orientation}
                lightSquareColor={boardTheme.light}
                darkSquareColor={boardTheme.dark}
                showCoordinates={settings.showCoordinates}
                positionKey={gameEndKey}
                onMove={handleMove}
              />
            </div>
          </div>
          {playerBar(bottomColor)}
          <GameToolbar
            canUndo={pliesToUndo > 0}
            onUndo={undo}
            onFlip={() => setOrientation((side) => (side === "white" ? "black" : "white"))}
            onImportExport={() => openImportExport("export")}
            onSettings={() => setDialog("settings")}
          />
        </section>

        <aside className="mx-auto w-full max-w-[640px] lg:col-start-1 lg:row-start-1">
          <Card className="gap-4">
            <CardHeader>
              <CardTitle>Game</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" data-testid="game-mode">
                  {modeLabel(config)}
                </Badge>
                <Badge variant="outline" data-testid="time-control">
                  {timeControlLabel}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <StatusLine status={status} names={names} />
              {settings.showEvaluation && (
                <p className="text-muted-foreground text-sm" data-testid="evaluation">
                  Evaluation{" "}
                  <span className="text-foreground font-semibold tabular-nums">{evalDisplay.text}</span>
                  {evalDisplay.detail && <span> · {evalDisplay.detail}</span>}
                </p>
              )}
              {gameOver && (
                <Button variant="outline" onClick={() => setDialog("new")}>
                  Play again
                </Button>
              )}
            </CardContent>
          </Card>
        </aside>

        <aside className="mx-auto flex w-full max-w-[640px] flex-col gap-4 sm:gap-6 lg:col-start-3 lg:row-start-1">
          {config.mode === "jev" && computerColor && (
            <JevPanel
              jevColor={computerColor}
              personality={config.personality}
              difficulty={config.difficulty}
              thinking={jev.thinking}
              error={jev.error}
              decision={jev.lastDecision}
              gameOver={gameOver}
              onRetry={jev.retry}
            />
          )}
          {config.mode === "stockfish" && computerColor && (
            <StockfishPanel
              stockfishColor={computerColor}
              difficulty={config.difficulty}
              thinking={stockfish.thinking}
              error={stockfish.error}
              decision={stockfish.lastDecision}
              gameOver={gameOver}
              onRetry={stockfish.retry}
            />
          )}
          <Card className="gap-2">
            <CardHeader>
              <CardTitle>Moves</CardTitle>
            </CardHeader>
            <CardContent>
              <MoveHistory
                rows={rows}
                lastPly={game.history.length - 1}
                className={cn(
                  "max-h-64",
                  isAiGame(config)
                    ? "lg:max-h-[min(14rem,calc(100dvh_-_36rem))]"
                    : "lg:max-h-[min(28rem,calc(100dvh_-_14rem))]",
                )}
              />
            </CardContent>
          </Card>
        </aside>
      </main>

      <NewGameDialog
        open={dialog === "new"}
        onOpenChange={(open) => setDialog(open ? "new" : null)}
        defaults={{
          mode: settings.mode,
          timeControl: settings.timeControl,
          playerColor: settings.playerColor,
          personality: settings.personality,
          difficulty: settings.difficulty,
        }}
        onStart={startGame}
      />
      <SettingsDialog open={dialog === "settings"} onOpenChange={(open) => setDialog(open ? "settings" : null)} />
      <ImportExportDialog
        open={dialog === "import-export"}
        onOpenChange={(open) => setDialog(open ? "import-export" : null)}
        initialTab={importExportTab}
        fen={chess.fen()}
        pgn={pgn}
        onImport={importGame}
      />
      <GameOverDialog
        open={showGameOver}
        onOpenChange={(open) => {
          if (!open) setDismissedGameEnd(gameEndKey);
        }}
        status={status}
        names={names}
        subtitle={isAiGame(config) ? `${aiName(config)}: ${aiSetupLabel(config)}` : undefined}
        onRematch={rematch}
        onExport={() => {
          setDismissedGameEnd(gameEndKey);
          openImportExport("export");
        }}
      />
    </div>
  );
}

/** What the evaluation bar and caption show, including finished games. */
function describeEvaluation(
  evaluation: Evaluation,
  status: GameStatus,
): { share: number | null; text: string; detail: string | null; label: string } {
  if (status.kind === "checkmate" || status.kind === "timeout") {
    const text = status.winner === "w" ? "1-0" : "0-1";
    return { share: status.winner === "w" ? 1 : 0, text, detail: null, label: `Game over, ${text}.` };
  }
  if (status.kind === "draw") {
    return { share: 0.5, text: "½-½", detail: null, label: "Game over, drawn." };
  }
  if (evaluation.status === "error") {
    return { share: null, text: "unavailable", detail: evaluation.message, label: "Evaluation unavailable." };
  }
  if (evaluation.status === "analysing" && evaluation.score) {
    const text = formatScore(evaluation.score);
    return {
      share: whiteShare(evaluation.score),
      text,
      detail: `depth ${evaluation.depth}`,
      label: `Evaluation ${text}. ${describeScore(evaluation.score)}.`,
    };
  }
  return { share: null, text: "…", detail: "analysing", label: "Analysing the position." };
}

function isTimeoutEnd(status: GameStatus) {
  return (
    status.kind === "timeout" ||
    (status.kind === "draw" && status.reason === "timeout-vs-insufficient-material")
  );
}

function StatusLine({ status, names }: { status: GameStatus; names: Record<Color, string> }) {
  const side =
    status.kind === "playing"
      ? status.turn
      : status.kind === "checkmate" || status.kind === "timeout"
        ? status.winner
        : null;

  return (
    <div className="flex items-center gap-3">
      {side && (
        <span
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 rounded-full border",
            side === "w" ? "border-neutral-400 bg-white" : "border-neutral-900 bg-neutral-900 dark:border-neutral-500",
          )}
        />
      )}
      <p role="status" aria-live="polite" className="text-sm font-medium" data-testid="game-status">
        {describeStatus(status, names)}
      </p>
      {status.kind === "playing" && status.inCheck && (
        <Badge variant="destructive" className="ml-auto">
          Check
        </Badge>
      )}
      {status.kind !== "playing" && (
        <Badge className="ml-auto">{status.kind === "draw" ? "Draw" : winsPhrase(names[status.winner])}</Badge>
      )}
    </div>
  );
}
