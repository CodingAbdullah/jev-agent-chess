import type {
  JevDrawRequest,
  JevDrawResponse,
  JevEvaluateRequest,
  JevEvaluation,
  JevMoveRequest,
  JevMoveResponse,
} from "./types";

/** Post to one of the Jev routes. Throws with a readable message if the server fails. */
async function postJev<T>(path: string, request: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `The server returned HTTP ${response.status}.`);
  }
  return (await response.json()) as T;
}

/** Ask the server for Jev's move. */
export const requestJevMove = (request: JevMoveRequest, signal?: AbortSignal) =>
  postJev<JevMoveResponse>("/api/jev/move", request, signal);

/** Ask the server for Jev's view of a position. */
export const requestJevEvaluation = (request: JevEvaluateRequest, signal?: AbortSignal) =>
  postJev<JevEvaluation>("/api/jev/evaluate", request, signal);

/** Offer Jev a draw. */
export const requestJevDraw = (request: JevDrawRequest, signal?: AbortSignal) =>
  postJev<JevDrawResponse>("/api/jev/draw", request, signal);
