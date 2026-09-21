import type { CleanupConfig, AuthConfig } from "../config/schema.js";
import { buildAuthHeaders } from "./executor.js";

// Runs a single cleanup request after a mutation test case, using a value
// extracted from that case's response body (e.g. a newly created record's id).
// Failures here are logged but never thrown — a cleanup failure shouldn't
// crash the whole fuzz run, though it IS worth surfacing to the user.
export async function runCleanup(
  baseUrl: string,
  cleanup: CleanupConfig,
  responseBody: unknown,
  auth?: AuthConfig,
  resolvedToken?: string
): Promise<{ success: boolean; error?: string }> {
  if (!responseBody || typeof responseBody !== "object") {
    return { success: false, error: "no response body to extract cleanup value from" };
  }

  const value = (responseBody as Record<string, unknown>)[cleanup.responseField];
  if (value === undefined) {
    return {
      success: false,
      error: `response body had no field named "${cleanup.responseField}" to use for cleanup`,
    };
  }

  const resolvedPath = cleanup.path.replace("{{responseField}}", String(value));
  const url = new URL(resolvedPath, baseUrl);
  const headers = buildAuthHeaders(auth, resolvedToken);

  try {
    const res = await fetch(url, {
      method: cleanup.method,
      headers,
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return { success: false, error: `cleanup request returned status ${res.status}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: `cleanup request failed: ${String(err)}` };
  }
}