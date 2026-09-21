import { callGemini } from "./client.js";
import { withCache } from "./cache.js";
import type { ParamConfig } from "../config/schema.js";
import type { GeneratedValue, CaseCategory } from "../generators/caseCategory.js";

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          value: { type: "string" },
          expectRejection: { type: "boolean" },
        },
        required: ["value", "expectRejection"],
      },
    },
  },
  required: ["suggestions"],
};

type SuggestInput = {
  paramName: string;
  param: ParamConfig;
};

type RawSuggestion = { value: string; expectRejection: boolean };
type RawSuggestOutput = { suggestions: RawSuggestion[] };

function convertValue(raw: string, type: ParamConfig["type"]): unknown {
  if (type === "number") return Number(raw);
  if (type === "boolean") return raw === "true";
  return raw;
}

async function suggestEdgeCasesRaw(
  input: SuggestInput
): Promise<GeneratedValue<unknown>[]> {
  const { paramName, param } = input;

  const prompt = `
You are helping fuzz-test an API parameter for security and robustness issues.

Parameter name: "${paramName}"
Type: ${param.type}
${param.min !== undefined ? `Minimum: ${param.min}` : ""}
${param.max !== undefined ? `Maximum: ${param.max}` : ""}

Suggest 5 to 8 tricky, domain-aware test values for this parameter that a
naive random/boundary fuzzer would likely miss. Consider things like:
- SQL injection-shaped strings, if this looks like it could touch a database query
- XSS-shaped strings, if this looks like it could be rendered in a UI
- Unicode edge cases (emoji, right-to-left text, zero-width characters)
- Values that are technically valid but semantically strange (e.g. negative
  "page" numbers, a "limit" of exactly 0)

For EACH suggestion, also set "expectRejection": true if a well-behaved API
SHOULD reject this value (e.g. it's negative, non-numeric for a number field,
malformed, or otherwise invalid), or false if a well-behaved API should
ACCEPT it (e.g. it's a valid-but-unusual string like an XSS payload that's
still syntactically a normal string).

Return each suggestion's value as a plain string, even if the param type is
a number or boolean (e.g. "0" not 0, "true" not true) — converted afterward.
`.trim();

  const result = await callGemini<RawSuggestOutput>({
    prompt,
    responseSchema: RESPONSE_SCHEMA,
    timeoutMs: 20000,
  });

  return result.suggestions.map((s) => ({
    value: convertValue(s.value, param.type),
    category: (s.expectRejection ? "boundary-high" : "valid") as CaseCategory,
  }));
}

export const suggestEdgeCases = withCache("suggestEdgeCases", suggestEdgeCasesRaw);