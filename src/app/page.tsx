import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const GAME_MODES = ["vs Jev", "vs Stockfish", "Hybrid", "2 Players"] as const;

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <h1 className="text-lg font-semibold tracking-tight">♟ Jev Chess</h1>
        <Button disabled>New game</Button>
      </header>

      <main className="flex flex-1 items-center justify-center p-4 sm:p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>The board is on its way</CardTitle>
            <CardDescription>
              Chess against Jev, Stockfish, or both together. Play starts in the
              next build phase.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul aria-label="Game modes" className="flex flex-wrap gap-2">
              {GAME_MODES.map((mode) => (
                <li key={mode}>
                  <Badge variant="secondary">{mode}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
