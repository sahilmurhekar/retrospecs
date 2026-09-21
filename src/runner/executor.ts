import type { EndpointConfig, AuthConfig } from "../config/schema.js";
import type { TestCase } from "./caseBuilder.js";
import type { CaseCategory } from "../generators/caseCategory.js";

export type CaseResult = {
  status: number;
  latencyMs: number;
  params: Record<string, unknown>;
  categories: Record<string, CaseCategory>;
  responseBody?: unknown; // needed later for cleanup, to extract e.g. a created record's id
  error?: string;
};

export function buildAuthHeaders(
  auth: AuthConfig | undefined,
  resolvedToken: string | undefined
): Record<string, string> {
  if (!auth) return {};
  if (auth.header && auth.value) {
    return { [auth.header]: auth.value };
  }
  if (auth.login && resolvedToken) {
    return { Authorization: `Bearer ${resolvedToken}` };
  }
  return {};
}

// Decides where params go, based on the endpoint's method and configured
// paramLocation. GET defaults to query string; mutating methods default to body.
function resolveParamLocation(endpoint: EndpointConfig): "query" | "body" {
  if (endpoint.paramLocation) return endpoint.paramLocation;
  return endpoint.method === "GET" ? "query" : "body";
}

export async function runCase(
  baseUrl: string,
  endpoint: EndpointConfig,
  testCase: TestCase,
  auth?: AuthConfig,
  resolvedToken?: string
): Promise<CaseResult> {
  const url = new URL(endpoint.path, baseUrl);
  const location = resolveParamLocation(endpoint);

  const authHeaders = buildAuthHeaders(auth, resolvedToken);
  const headers: Record<string, string> = { ...authHeaders };
  let body: string | undefined;

  if (location === "query") {
    for (const [key, value] of Object.entries(testCase.params)) {
      url.searchParams.set(key, String(value));
    }
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(testCase.params);
  }

  const start = Date.now();

  try {
    const res = await fetch(url, {
      method: endpoint.method,
      headers,
      body,
      signal: AbortSignal.timeout(5000),
    });

    // try to parse a JSON body for later use (e.g. cleanup); tolerate non-JSON responses
    let responseBody: unknown;
    try {
      responseBody = await res.json();
    } catch {
      responseBody = undefined;
    }

    return {
      status: res.status,
      latencyMs: Date.now() - start,
      params: testCase.params,
      categories: testCase.categories,
      responseBody,
    };
  } catch (err) {
    return {
      status: 0,
      latencyMs: Date.now() - start,
      params: testCase.params,
      categories: testCase.categories,
      error: String(err),
    };
  }
}