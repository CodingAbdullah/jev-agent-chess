import { getJevClient } from "@/lib/jev/client";
import { decideMove } from "@/lib/jev/decide";
import { cancelled, NO_STORE, readJevRequest } from "@/lib/jev/route";
import { parseMoveRequest } from "@/lib/jev/validate";

/** Ask Jev for its next move. The API key stays on the server. */
export async function POST(request: Request) {
  const parsed = await readJevRequest(request, parseMoveRequest);
  if (!parsed.ok) return parsed.response;

  const { client, mode } = getJevClient();
  try {
    const decision = await decideMove({ client, mode, request: parsed.value, signal: request.signal });
    return Response.json(decision, { headers: NO_STORE });
  } catch {
    // Only reachable when the browser cancelled the request.
    return cancelled();
  }
}
