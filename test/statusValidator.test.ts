import { describe, it, expect } from "vitest";
import { validateStatus } from "../src/validators/statusValidator";
import type { CaseResult } from "../src/runner/executor";

describe("validateStatus", () => {
  it("passes a valid case that returns 200", () => {
    const result: CaseResult = {
      status: 200,
      latencyMs: 10,
      params: { id: 5 },
      categories: { id: "valid" },
    };
    const validated = validateStatus(result);
    expect(validated.pass).toBe(true);
    expect(validated.expectedOutcome).toBe("success");
  });

  it("passes a boundary-low case that correctly returns 400", () => {
    const result: CaseResult = {
      status: 400,
      latencyMs: 10,
      params: { id: 0 },
      categories: { id: "boundary-low" },
    };
    const validated = validateStatus(result);
    expect(validated.pass).toBe(true);
    expect(validated.expectedOutcome).toBe("rejection");
  });

  it("fails a valid case that unexpectedly returns 400", () => {
    const result: CaseResult = {
      status: 400,
      latencyMs: 10,
      params: { id: 5 },
      categories: { id: "valid" },
    };
    const validated = validateStatus(result);
    expect(validated.pass).toBe(false);
  });

  it("fails a boundary case that unexpectedly returns 200 (real bug: missing validation)", () => {
    const result: CaseResult = {
      status: 200,
      latencyMs: 10,
      params: { id: 0 },
      categories: { id: "boundary-low" },
    };
    const validated = validateStatus(result);
    expect(validated.pass).toBe(false);
  });

  it("always fails on a 500, even if a rejection was expected", () => {
    const result: CaseResult = {
      status: 500,
      latencyMs: 10,
      params: { id: 0 },
      categories: { id: "boundary-low" },
    };
    const validated = validateStatus(result);
    expect(validated.pass).toBe(false);
  });

  it("always fails on a timeout (status 0)", () => {
    const result: CaseResult = {
      status: 0,
      latencyMs: 5000,
      params: {},
      categories: {},
      error: "timeout",
    };
    const validated = validateStatus(result);
    expect(validated.pass).toBe(false);
  });

  it("expects rejection overall if any one param among several is a boundary case", () => {
    const result: CaseResult = {
      status: 400,
      latencyMs: 10,
      params: { page: 1, limit: 0 },
      categories: { page: "valid", limit: "boundary-low" },
    };
    const validated = validateStatus(result);
    expect(validated.expectedOutcome).toBe("rejection");
    expect(validated.pass).toBe(true);
  });
});