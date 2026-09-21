import type { AuthConfig } from "../config/schema.js";

// If the config uses login mode, fetch a token once before the run starts.
// If it uses static mode (or no auth at all), there's nothing to do here —
// returns undefined, and buildAuthHeaders will handle the static case itself.
export async function resolveAuthToken(
  baseUrl: string,
  auth: AuthConfig | undefined
): Promise<string | undefined> {
  if (!auth?.login) return undefined;

  const { path, method, body, tokenField } = auth.login;
  const url = new URL(path, baseUrl);

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    throw new Error(`Login request to ${url} failed: ${String(err)}`);
  }

  if (!res.ok) {
    throw new Error(`Login request to ${url} returned status ${res.status}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  const token = data[tokenField];

  if (typeof token !== "string") {
    throw new Error(
      `Login response did not contain a string field named "${tokenField}". ` +
      `Got: ${JSON.stringify(data)}`
    );
  }

  return token;
}