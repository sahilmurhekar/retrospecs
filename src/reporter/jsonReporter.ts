import fs from "node:fs/promises";
import path from "node:path";
import type { ValidatedResult } from "../validators/statusValidator.js";

export type CategoryBreakdown = {
  total: number;
  passed: number;
  failed: number;
};

export type RunSummary = {
  seed: string;
  total: number;
  passed: number;
  failed: number;
  avgLatencyMs: number;
  byOutcome: {
    success: CategoryBreakdown;
    rejection: CategoryBreakdown;
  };
  unexpectedFailures: ValidatedResult[];
};

function emptyBreakdown(): CategoryBreakdown {
  return { total: 0, passed: 0, failed: 0 };
}

export function buildSummary(results: ValidatedResult[], seed: string): RunSummary {
  const failing = results.filter((r) => !r.pass);
  const totalLatency = results.reduce((sum, r) => sum + r.latencyMs, 0);

  const byOutcome = {
    success: emptyBreakdown(),
    rejection: emptyBreakdown(),
  };

  for (const r of results) {
    const bucket = byOutcome[r.expectedOutcome];
    bucket.total += 1;
    if (r.pass) bucket.passed += 1;
    else bucket.failed += 1;
  }

  return {
    seed,
    total: results.length,
    passed: results.length - failing.length,
    failed: failing.length,
    avgLatencyMs: results.length > 0 ? Math.round(totalLatency / results.length) : 0,
    byOutcome,
    unexpectedFailures: failing,
  };
}

export async function writeReport(
  results: ValidatedResult[],
  outDir: string,
  seed: string
): Promise<void> {
  await fs.mkdir(outDir, { recursive: true });

  const resultsPath = path.join(outDir, "results.json");
  const summaryPath = path.join(outDir, "summary.json");

  const summary = buildSummary(results, seed);

  await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
}