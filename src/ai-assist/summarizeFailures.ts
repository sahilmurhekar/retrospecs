import { callGemini } from "./client.js";
import type { ValidatedResult } from "../validators/statusValidator.js";
import type { EndpointConfig } from "../config/schema.js";

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    groups: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          explanation: { type: "string" },
          likelyRealBug: { type: "boolean" },
          affectedCaseCount: { type: "number" },
        },
        required: ["title", "explanation", "likelyRealBug", "affectedCaseCount"],
      },
    },
    overallSummary: { type: "string" },
  },
  required: ["groups", "overallSummary"],
};

export type FailureGroup = {
  title: string;
  explanation: string;
  likelyRealBug: boolean;
  affectedCaseCount: number;
};

export type FailureSummary = {
  groups: FailureGroup[];
  overallSummary: string;
};

// Deliberately NOT wrapped in withCache — failure sets are different on
// every run (different random values, different seeds), so caching by
// content hash would rarely hit anyway, and a stale summary of failures
// that no longer exist would be actively misleading.
export async function summarizeFailures(
  failures: ValidatedResult[],
  endpoint?: EndpointConfig
): Promise<FailureSummary> {
  if (failures.length === 0) {
    return { groups: [], overallSummary: "No unexpected failures — everything behaved as expected." };
  }

  // keep the payload reasonably small — send at most 30 representative
  // failures, since a huge dump doesn't help Gemini reason better and
  // costs more tokens/time for no real benefit
  const sample = failures.slice(0, 30);

  // without this, Gemini only sees the failure's response and has no way
  // to know what the config actually declared as valid — leading it to
  // sometimes call a real missing-validation bug a "fuzzer misclassification"
  const configContext = endpoint
    ? `\nThe endpoint's declared valid parameter rules (from the fuzz config) are:\n${JSON.stringify(endpoint.params, null, 2)}\n`
    : "";

  const prompt = `
You are helping a developer triage failures from an API fuzz-testing run.
Below is a JSON array of test cases that failed unexpectedly (the API
returned a different result than expected, given the input).
${configContext}
For each failure, "expectedOutcome" says whether a well-behaved API should
have returned success (2xx) or a rejection (4xx) for that input, and "status"
is what it actually returned. IMPORTANT: cross-check each failing value
against the declared min/max rules above — if a value falls OUTSIDE the
declared valid range but the API still returned a 2xx, that is very likely
a REAL bug (the API is missing validation), not a fuzzer misclassification.

Group these failures into a small number of clusters based on likely shared
root cause (e.g. "missing upper-bound validation on X", "server crashes on
unicode input", "AI misclassified an in-range value as a boundary case").

For each group, say whether you think it's a genuine bug in the API
("likelyRealBug": true) or possibly a misclassification from the fuzzing
tool itself ("likelyRealBug": false) — e.g. if the input actually looks
valid and rejecting it seems like the fuzzer's expectation was wrong, not
the API's fault.

Failures:
${JSON.stringify(sample, null, 2)}
`.trim();

  return callGemini<FailureSummary>({
    prompt,
    responseSchema: RESPONSE_SCHEMA,
    timeoutMs: 30000,
  });
}