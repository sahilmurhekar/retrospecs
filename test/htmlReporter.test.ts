import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { writeHtmlReport } from "../src/reporter/htmlReporter";
import type { ValidatedResult } from "../src/validators/statusValidator";

const TEST_OUT_DIR = path.join(process.cwd(), "test-output-tmp-html");

afterEach(async () => {
  await fs.rm(TEST_OUT_DIR, { recursive: true, force: true });
});

describe("writeHtmlReport", () => {
  it("writes a report.html file to disk", async () => {
    const results: ValidatedResult[] = [
      { status: 200, latencyMs: 10, params: { id: 1 }, categories: { id: "valid" }, pass: true, expectedOutcome: "success" },
    ];
    await writeHtmlReport(results, TEST_OUT_DIR, "test-seed", "getUser");

    const html = await fs.readFile(path.join(TEST_OUT_DIR, "report.html"), "utf-8");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("getUser");
    expect(html).toContain("test-seed");
  });

  it("renders unexpected failures with their params and response body", async () => {
    const results: ValidatedResult[] = [
      {
        status: 500,
        latencyMs: 42,
        params: { id: 5 },
        categories: { id: "valid" },
        pass: false,
        expectedOutcome: "success",
        responseBody: { error: "boom" },
      },
    ];
    await writeHtmlReport(results, TEST_OUT_DIR, "test-seed", "getUser");

    const html = await fs.readFile(path.join(TEST_OUT_DIR, "report.html"), "utf-8");
    expect(html).toContain("Unexpected failures (1)");
    expect(html).toContain("boom");
    expect(html).toContain("42ms");
  });

  it("renders a friendly empty state when there are no unexpected failures", async () => {
    const results: ValidatedResult[] = [
      { status: 200, latencyMs: 10, params: {}, categories: {}, pass: true, expectedOutcome: "success" },
    ];
    await writeHtmlReport(results, TEST_OUT_DIR, "test-seed", "getUser");

    const html = await fs.readFile(path.join(TEST_OUT_DIR, "report.html"), "utf-8");
    expect(html).toContain("No unexpected failures");
  });

  it("escapes HTML-unsafe characters in params so the report can't be broken by response content", async () => {
    const results: ValidatedResult[] = [
      {
        status: 500,
        latencyMs: 5,
        params: { name: "<script>alert(1)</script>" },
        categories: { name: "valid" },
        pass: false,
        expectedOutcome: "success",
      },
    ];
    await writeHtmlReport(results, TEST_OUT_DIR, "test-seed", "getUser");

    const html = await fs.readFile(path.join(TEST_OUT_DIR, "report.html"), "utf-8");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
