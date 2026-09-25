"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        The board hit an unexpected problem. Trying again usually fixes it. Your settings are kept.
      </p>
      <div className="flex gap-2">
        <Button onClick={() => retry()}>Try again</Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload the page
        </Button>
      </div>
    </main>
  );
}
