import { getJevClient } from "@/lib/jev/client";
import { evaluatePosition, JevUnavailableError } from "@/lib/jev/judge";
import { cancelled, jsonError, NO_STORE, readJevRequest } from "@/lib/jev/route";
import { parseEvaluateRequest } from "@/lib/jev/validate";

/** Ask Jev who stands better, for the evaluation bar in Jev games. */
export async function POST(request: Request) {
  const parsed = await readJevRequest(request, parseEvaluateRequest);
  if (!parsed.ok) return parsed.response;

  const { client, mode } = getJevClient();
  try {
    const evaluation = await evaluatePosition({ client, mode, ...parsed.value, signal: request.signal });
    return Response.json(evaluation, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof JevUnavailableError) return jsonError(error.message, 502);
    return cancelled();
  }
}
