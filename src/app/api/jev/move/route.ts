import { getJevClient } from "@/lib/jev/client";
import { decideMove } from "@/lib/jev/decide";
import { MAX_BODY_BYTES, parseMoveRequest } from "@/lib/jev/validate";
import { clientKey, jevRateLimiters, type RateLimitResult } from "@/lib/rate-limit";

const NO_STORE = { "Cache-Control": "no-store" };

/** Ask Jev for its next move. The API key stays on the server. */
export async function POST(request: Request) {
  const limiters = jevRateLimiters();
  const limited =
    rejectIfLimited(limiters.perClient.check(clientKey(request.headers)), "You are asking for moves too quickly.") ??
    rejectIfLimited(limiters.global.check("all"), "Jev is busy right now.");
  if (limited) return limited;

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

function rejectIfLimited(result: RateLimitResult, message: string): Response | null {
  if (result.allowed) return null;
  const seconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
  return Response.json(
    { error: `${message} Try again in ${seconds} second${seconds === 1 ? "" : "s"}.` },
    { status: 429, headers: { ...NO_STORE, "Retry-After": String(seconds) } },
  );
}
