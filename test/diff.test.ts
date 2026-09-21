import { describe, it, expect } from "vitest";
import { diffResults } from "../src/reporter/diff";
import type { ValidatedResult } from "../src/validators/statusValidator";

function makeResult(status: number, pass: boolean, params: Record<string, unknown>): ValidatedResult {
  return { status, latencyMs: 1, params, categories: {}, pass, expectedOutcome: "success" };
}

describe("diffResults", () => {
  it("detects a regression (was passing, now failing)", () => {
    const baseline = [makeResult(200, true, { id: 1 })];
    const current = [makeResult(500, false, { id: 1 })];
    const diff = diffResults(baseline, current);
    expect(diff.regressions.length).toBe(1);
    expect(diff.improvements.length).toBe(0);
  });

  it("detects an improvement (was failing, now passing)", () => {
    const baseline = [makeResult(500, false, { id: 1 })];
    const current = [makeResult(200, true, { id: 1 })];
    const diff = diffResults(baseline, current);
    expect(diff.improvements.length).toBe(1);
    expect(diff.regressions.length).toBe(0);
  });

  it("counts unchanged cases correctly", () => {
    const baseline = [makeResult(200, true, { id: 1 })];
    const current = [makeResult(200, true, { id: 1 })];
    const diff = diffResults(baseline, current);
    expect(diff.unchanged).toBe(1);
  });

  it("ignores cases not present in the baseline", () => {
    const baseline: ValidatedResult[] = [];
    const current = [makeResult(200, true, { id: 99 })];
    const diff = diffResults(baseline, current);
    expect(diff.regressions.length).toBe(0);
    expect(diff.improvements.length).toBe(0);
    expect(diff.unchanged).toBe(0);
  });
});