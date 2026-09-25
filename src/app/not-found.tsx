import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground text-sm">There is nothing here. The board is on the home page.</p>
      <Button asChild>
        <Link href="/">Back to the board</Link>
      </Button>
    </main>
  );
}
