import { getJevClient } from "@/lib/jev/client";
import { decideMove } from "@/lib/jev/decide";
import { MAX_BODY_BYTES, parseMoveRequest } from "@/lib/jev/validate";

const NO_STORE = { "Cache-Control": "no-store" };

/** Ask Jev for its next move. The API key stays on the server. */
export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return Response.json({ error: "Request body is too large." }, { status: 413, headers: NO_STORE });
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400, headers: NO_STORE });
  }

  const parsed = parseMoveRequest(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: parsed.status, headers: NO_STORE });
  }

  const { client, mode } = getJevClient();
  try {
    const decision = await decideMove({ client, mode, request: parsed.value, signal: request.signal });
    return Response.json(decision, { headers: NO_STORE });
  } catch {
    // Only reachable when the browser cancelled the request.
    return new Response(null, { status: 499, headers: NO_STORE });
  }
}
