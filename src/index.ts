import path from "node:path";
import { configSchema, type FuzzConfig } from "./config/schema.js";
import { assertLocalhost } from "./runner/localhostGuard.js";
import { buildCases, buildCasesWithAiSuggestions } from "./runner/caseBuilder.js";
import { runCase } from "./runner/executor.js";
import { resolveAuthToken } from "./runner/authenticator.js";
import { runCleanup } from "./runner/cleanup.js";
import { validateStatus, type ValidatedResult } from "./validators/statusValidator.js";
import { writeReport } from "./reporter/jsonReporter.js";
import { writeHtmlReport } from "./reporter/htmlReporter.js";
import { runWithConcurrencyLimit } from "./runner/concurrencyPool.js";
import { getCurrentSeed } from "./runner/rng.js";

const DEFAULT_CONCURRENCY = 10;
const CIRCUIT_BREAKER_THRESHOLD = 10;

export type RunFuzzOptions = {
  outRoot?: string;
  concurrency?: number;
  aiEdgeCases?: boolean;
  htmlReport?: boolean;
};

export type EndpointResults = Record<string, ValidatedResult[]>;

export async function runFuzz(
  config: FuzzConfig,
  options: RunFuzzOptions = {}
): Promise<EndpointResults> {
  const outRoot = options.outRoot ?? "./fuzz-results";
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;

  await assertLocalhost(config.baseUrl);

  let resolvedToken: string | undefined;
  if (config.auth?.login) {
    console.log("Logging in to resolve auth token...");
    resolvedToken = await resolveAuthToken(config.baseUrl, config.auth);
    console.log("✅ Auth token resolved.");
  }

  const allResults: EndpointResults = {};

  for (const endpoint of config.endpoints) {
    console.log(
      `\nRunning ${endpoint.testCount} cases for "${endpoint.name}" (concurrency: ${concurrency})...`
    );

       const cases = options.aiEdgeCases
      ? await buildCasesWithAiSuggestions(endpoint)
      : buildCases(endpoint);

    let consecutiveFailures = 0;
    let circuitTripped = false;
    let cleanupFailures = 0;

    const results = await runWithConcurrencyLimit(cases, concurrency, async (testCase) => {
      if (circuitTripped) {
        return {
          status: 0,
          latencyMs: 0,
          params: testCase.params,
          categories: testCase.categories,
          error: "circuit breaker tripped — request skipped",
        };
      }

      const result = await runCase(config.baseUrl, endpoint, testCase, config.auth, resolvedToken);

      // if this was a mutation that succeeded, clean it up immediately
      if (endpoint.allowMutations && endpoint.cleanup && result.status >= 200 && result.status < 300) {
        const cleanupResult = await runCleanup(
          config.baseUrl,
          endpoint.cleanup,
          result.responseBody,
          config.auth,
          resolvedToken
        );
        if (!cleanupResult.success) {
          cleanupFailures++;
          console.log(`  ⚠️  Cleanup failed for a test case: ${cleanupResult.error}`);
        }
      }

      if (result.status === 0) {
        consecutiveFailures++;
        if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD && !circuitTripped) {
          circuitTripped = true;
          console.log(
            `  ⚠️  Circuit breaker tripped after ${CIRCUIT_BREAKER_THRESHOLD} consecutive failures — skipping remaining cases.`
          );
        }
      } else {
        consecutiveFailures = 0;
      }

      return result;
    });

    if (cleanupFailures > 0) {
      console.log(
        `  ⚠️  ${cleanupFailures} cleanup request(s) failed for "${endpoint.name}" — some test data may remain in your database.`
      );
    }

    const validated = results.map((result) => validateStatus(result));
    allResults[endpoint.name] = validated;

    const outDir = path.join(outRoot, endpoint.name);
    await writeReport(validated, outDir, getCurrentSeed());
    if (options.htmlReport) {
      await writeHtmlReport(validated, outDir, getCurrentSeed(), endpoint.name);
    }

    const passed = validated.filter((r) => r.pass).length;
    console.log(`  ${passed}/${validated.length} passed → results saved to ${outDir}`);
  }

  return allResults;
}

export { configSchema, type FuzzConfig };