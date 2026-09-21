import { callGemini } from "./client.js";
import { withCache } from "./cache.js";
import { configSchema, type FuzzConfig, type ParamConfig } from "../config/schema.js";

// Gemini's structured output doesn't support "additionalProperties" (dynamic
// object keys), so we ask for params as an array here, then convert to our
// real Record<string, ParamConfig> shape after the AI call returns.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    baseUrl: { type: "string" },
    endpoints: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          method: { type: "string", enum: ["GET"] },
          path: { type: "string" },
          params: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                type: { type: "string", enum: ["string", "number", "boolean"] },
                min: { type: "number" },
                max: { type: "number" },
              },
              required: ["name", "type"],
            },
          },
        },
        required: ["name", "method", "path", "params"],
      },
    },
  },
  required: ["baseUrl", "endpoints"],
};

type RawParam = { name: string; type: "string" | "number" | "boolean"; min?: number; max?: number };
type RawEndpoint = { name: string; method: "GET"; path: string; params: RawParam[] };
type RawGeminiOutput = { baseUrl: string; endpoints: RawEndpoint[] };

type SpecInput = {
  description: string;
  baseUrl: string;
};

function paramsArrayToRecord(params: RawParam[]): Record<string, ParamConfig> {
  const record: Record<string, ParamConfig> = {};
  for (const p of params) {
    record[p.name] = { type: p.type, min: p.min, max: p.max };
  }
  return record;
}

async function generateConfigFromSpecRaw(input: SpecInput): Promise<FuzzConfig> {
  const prompt = `
You are helping generate a test configuration for an API fuzz-testing tool.
Given the following description of an API endpoint (which may be plain English
or a curl command), produce a config matching the required JSON schema.

Rules:
- Only generate GET endpoints. If the description implies a mutating method
  (POST/PUT/PATCH/DELETE), still describe it as GET with no params rather than guessing.
- Only include params with type "string", "number", or "boolean".
- For number params, infer sensible min/max bounds from context if possible; otherwise omit them.
- The baseUrl must be exactly: "${input.baseUrl}"

Description:
${input.description}
`.trim();

  const rawResult = await callGemini<RawGeminiOutput>({
    prompt,
    responseSchema: RESPONSE_SCHEMA,
    timeoutMs: 50000, // config generation can take longer than simple queries
  });

  // convert the array-shaped params Gemini gave us into our real config shape
  const converted = {
    baseUrl: rawResult.baseUrl,
    endpoints: rawResult.endpoints.map((e) => ({
      name: e.name,
      method: e.method,
      path: e.path,
      params: paramsArrayToRecord(e.params),
    })),
  };

  const parsed = configSchema.safeParse(converted);
  if (!parsed.success) {
    throw new Error(
      `Gemini produced a config that failed validation: ${parsed.error.message}`
    );
  }

  return parsed.data;
}

export const generateConfigFromSpec = withCache("generateConfigFromSpec", generateConfigFromSpecRaw);