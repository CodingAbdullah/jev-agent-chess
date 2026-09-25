import { getJevClient } from "@/lib/jev/client";
import { decideDraw } from "@/lib/jev/judge";
import { cancelled, NO_STORE, readJevRequest } from "@/lib/jev/route";
import { parseDrawRequest } from "@/lib/jev/validate";

/** Offer Jev a draw. Jev answers yes or no; a simple rule decides if Jev fails. */
export async function POST(request: Request) {
  const parsed = await readJevRequest(request, parseDrawRequest);
  if (!parsed.ok) return parsed.response;

  const { client, mode } = getJevClient();
  try {
    const answer = await decideDraw({ client, mode, ...parsed.value, signal: request.signal });
    return Response.json(answer, { headers: NO_STORE });
  } catch {
    // Only reachable when the browser cancelled the request.
    return cancelled();
  }
}
