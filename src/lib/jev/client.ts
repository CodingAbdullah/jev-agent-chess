import "server-only";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { createMockFetch } from "./mock";

export type JevMode = "live" | "mock";

export type JevClient = Pick<TypeSafeClient, "systemOne">;

let cached: { signature: string; client: JevClient; mode: JevMode } | null = null;

/**
 * The Jev client for this server. It uses the live API when TYPESAFE_API_KEY
 * is set, and the local mock otherwise, or when JEV_MOCK=1 forces it.
 * The key is read here, on the server, and is never sent to the browser.
 */
export function getJevClient(env: NodeJS.ProcessEnv = process.env): { client: JevClient; mode: JevMode } {
  const apiKey = env.TYPESAFE_API_KEY?.trim();
  const mode: JevMode = apiKey && env.JEV_MOCK !== "1" ? "live" : "mock";
  // Rebuild only if the configuration changes. The signature never contains the key itself.
  const signature = `${mode}:${apiKey ? apiKey.length : 0}:${env.TYPESAFE_BASE_URL ?? ""}`;
  if (cached?.signature === signature) return cached;

  const client =
    mode === "live"
      ? new TypeSafeClient({ apiKey, timeout: 8_000, retry: { maxRetries: 1 } })
      : new TypeSafeClient({
          apiKey: "mock",
          baseURL: "https://jev-mock.invalid",
          fetch: createMockFetch(),
          retry: { maxRetries: 0 },
          logLevel: "off",
        });

  cached = { signature, client, mode };
  return cached;
}
