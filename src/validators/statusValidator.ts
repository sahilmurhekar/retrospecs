import type { CaseResult } from "../runner/executor.js";
import { expectedOutcomeFor } from "../generators/caseCategory.js";

export type ValidatedResult = CaseResult & {
  pass: boolean;
  expectedOutcome: "success" | "rejection";
};

// A response is a "success" if it's in the 2xx range,
// a "rejection" if it's in the 4xx range — anything else (5xx, 0/timeout)
// is always a failure, regardless of what was expected.
function actualOutcome(status: number): "success" | "rejection" | "error" {
  if (status >= 200 && status < 300) return "success";
  if (status >= 400 && status < 500) return "rejection";
  return "error";
}

// Determines the single "overall" expected outcome for a test case that
// may involve multiple params with different categories. If ANY param is
// a boundary/invalid category, we expect the whole request to be rejected —
// since one bad param is enough to make a real API reject the request.
function overallExpectedOutcome(categories: Record<string, string>): "success" | "rejection" {
  const values = Object.values(categories) as Parameters<typeof expectedOutcomeFor>[0][];
  const anyExpectedRejection = values.some((c) => expectedOutcomeFor(c) === "rejection");
  return anyExpectedRejection ? "rejection" : "success";
}

export function validateStatus(result: CaseResult): ValidatedResult {
  const expected = overallExpectedOutcome(result.categories);
  const actual = actualOutcome(result.status);

  // A 5xx or a timeout (actual === "error") is ALWAYS a failure,
  // no matter what we expected — a real bug, never intentional.
  const pass = actual !== "error" && actual === expected;

  return {
    ...result,
    pass,
    expectedOutcome: expected,
  };
}