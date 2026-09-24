import type { JevMoveRequest, JevMoveResponse } from "./types";

/** Ask the server for Jev's move. Throws with a readable message if the server fails. */
export async function requestJevMove(request: JevMoveRequest, signal?: AbortSignal): Promise<JevMoveResponse> {
  const response = await fetch("/api/jev/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `The server returned HTTP ${response.status}.`);
  }
  return (await response.json()) as JevMoveResponse;
}
