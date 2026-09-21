import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { buildSummary, writeReport } from "../src/reporter/jsonReporter";
import type { ValidatedResult } from "../src/validators/statusValidator";

const TEST_OUT_DIR = path.join(process.cwd(), "test-output-tmp");

afterEach(async () => {
  await fs.rm(TEST_OUT_DIR, { recursive: true, force: true });
});

describe("buildSummary", () => {
  it("counts passed and failed correctly across both outcome types", () => {
    const results: ValidatedResult[] = [
      { status: 200, latencyMs: 10, params: {}, categories: {}, pass: true, expectedOutcome: "success" },
      { status: 400, latencyMs: 20, params: {}, categories: {}, pass: true, expectedOutcome: "rejection" },
      { status: 500, latencyMs: 30, params: {}, categories: {}, pass: false, expectedOutcome: "rejection" },
    ];
    const summary = buildSummary(results,"test-seed");

    expect(summary.total).toBe(3);
    expect(summary.passed).toBe(2);
    expect(summary.failed).toBe(1);
  });

  it("breaks results down correctly by expected outcome", () => {
    const results: ValidatedResult[] = [
      { status: 200, latencyMs: 10, params: {}, categories: {}, pass: true, expectedOutcome: "success" },
      { status: 400, latencyMs: 10, params: {}, categories: {}, pass: false, expectedOutcome: "success" }, // real bug
      { status: 400, latencyMs: 10, params: {}, categories: {}, pass: true, expectedOutcome: "rejection" },
    ];
    const summary = buildSummary(results,"test-seed");

    expect(summary.byOutcome.success.total).toBe(2);
    expect(summary.byOutcome.success.passed).toBe(1);
    expect(summary.byOutcome.success.failed).toBe(1);

    expect(summary.byOutcome.rejection.total).toBe(1);
    expect(summary.byOutcome.rejection.passed).toBe(1);
    expect(summary.byOutcome.rejection.failed).toBe(0);
  });

  it("only includes genuine failures in unexpectedFailures, not healthy rejections", () => {
    const results: ValidatedResult[] = [
      { status: 400, latencyMs: 10, params: { id: 0 }, categories: { id: "boundary-low" }, pass: true, expectedOutcome: "rejection" },
      { status: 500, latencyMs: 10, params: { id: 5 }, categories: { id: "valid" }, pass: false, expectedOutcome: "success" },
    ];
    const summary = buildSummary(results,"test-seed");

    expect(summary.unexpectedFailures.length).toBe(1);
    expect(summary.unexpectedFailures[0].status).toBe(500);
  });

  it("computes average latency correctly", () => {
    const results: ValidatedResult[] = [
      { status: 200, latencyMs: 10, params: {}, categories: {}, pass: true, expectedOutcome: "success" },
      { status: 200, latencyMs: 20, params: {}, categories: {}, pass: true, expectedOutcome: "success" },
    ];
    const summary = buildSummary(results,"test-seed");
    expect(summary.avgLatencyMs).toBe(15);
  });

  it("handles an empty results list without crashing", () => {
    const summary = buildSummary([], "test-seed");
    expect(summary.total).toBe(0);
    expect(summary.avgLatencyMs).toBe(0);
    expect(summary.byOutcome.success.total).toBe(0);
  });
});

describe("writeReport", () => {
  it("writes results.json and summary.json to disk", async () => {
    const results: ValidatedResult[] = [
      { status: 200, latencyMs: 10, params: { id: 1 }, categories: { id: "valid" }, pass: true, expectedOutcome: "success" },
    ];
    await writeReport(results, TEST_OUT_DIR, "test-seed");

    const resultsRaw = await fs.readFile(path.join(TEST_OUT_DIR, "results.json"), "utf-8");
    const summaryRaw = await fs.readFile(path.join(TEST_OUT_DIR, "summary.json"), "utf-8");

    const parsedResults = JSON.parse(resultsRaw);
    const parsedSummary = JSON.parse(summaryRaw);

    expect(parsedResults.length).toBe(1);
    expect(parsedSummary.total).toBe(1);
  });
});