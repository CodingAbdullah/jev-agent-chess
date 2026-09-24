"use client";

import dynamic from "next/dynamic";

/**
 * The game reads saved settings from the browser on its first render, so it is
 * rendered only on the client. The fallback matches the layout to avoid a jump.
 */
export const ChessAppLoader = dynamic(
  () => import("./chess-app").then((module) => module.ChessApp),
  { ssr: false, loading: LoadingShell },
);

function LoadingShell() {
  return (
    <div className="flex flex-1 flex-col" aria-busy="true">
      <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <h1 className="text-lg font-semibold tracking-tight">♟ Jev Chess</h1>
      </header>
      <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-2 p-4 sm:p-6">
        <div className="h-12" />
        <div className="bg-muted aspect-square w-full animate-pulse motion-reduce:animate-none rounded-lg" />
        <p className="sr-only">Loading the board…</p>
      </main>
    </div>
  );
}
