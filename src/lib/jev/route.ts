import "server-only";
import { clientKey, jevRateLimiters, type RateLimitResult } from "@/lib/rate-limit";
import { MAX_BODY_BYTES, type Parsed } from "./validate";

/** Jev's answers depend on the position, so nothing may be cached. */
export const NO_STORE = { "Cache-Control": "no-store" };

export const jsonError = (error: string, status: number) =>
  Response.json({ error }, { status, headers: NO_STORE });

/**
 * The checks every Jev route runs before it spends the API key's quota: the
 * rate limits, the body size, JSON, and the route's own validation. Returns
 * the parsed request, or the response to send instead.
 */
export async function readJevRequest<T>(
  request: Request,
  parse: (body: unknown) => Parsed<T>,
): Promise<{ ok: true; value: T } | { ok: false; response: Response }> {
  const limiters = jevRateLimiters();
  // The global bucket is only charged for requests the client's own limit allows.
  const limited =
    rejectIfLimited(await limiters.perClient.check(clientKey(request.headers)), "You are asking Jev too quickly.") ??
    rejectIfLimited(await limiters.global.check("all"), "Jev is busy right now.");
  if (limited) return { ok: false, response: limited };

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return { ok: false, response: jsonError("Request body is too large.", 413) };

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, response: jsonError("Request body must be JSON.", 400) };
  }

  const parsed = parse(body);
  if (!parsed.ok) return { ok: false, response: jsonError(parsed.error, parsed.status) };
  return { ok: true, value: parsed.value };
}

/** The browser cancelled the request, so nobody reads the answer. */
export const cancelled = () => new Response(null, { status: 499, headers: NO_STORE });

function rejectIfLimited(result: RateLimitResult, message: string): Response | null {
  if (result.allowed) return null;
  const seconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
  return Response.json(
    { error: `${message} Try again in ${seconds} second${seconds === 1 ? "" : "s"}.` },
    { status: 429, headers: { ...NO_STORE, "Retry-After": String(seconds) } },
  );
}
