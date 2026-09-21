import { generateNumberCases } from "../generators/number.js";
import { generateStringCases } from "../generators/string.js";
import { generateBooleanCases } from "../generators/boolean.js";
import type { EndpointConfig, ParamConfig } from "../config/schema.js";
import type { CaseCategory, GeneratedValue } from "../generators/caseCategory.js";
import { suggestEdgeCases } from "../ai-assist/suggestEdgeCases.js";

export type TestCase = {
  params: Record<string, unknown>;
  categories: Record<string, CaseCategory>;
};

function generateValuesForParam(
  param: ParamConfig,
  count: number
): GeneratedValue<unknown>[] {
  switch (param.type) {
    case "number":
      return generateNumberCases(param.min ?? -100, param.max ?? 100, count);
    case "string":
      return generateStringCases(param.min ?? 0, param.max ?? 50, count);
    case "boolean":
      return generateBooleanCases(count);
    default:
      throw new Error(`No generator implemented for param type "${param.type}"`);
  }
}

export function buildCases(endpoint: EndpointConfig): TestCase[] {
  const paramNames = Object.keys(endpoint.params);
  const count = endpoint.testCount;

  if (paramNames.length === 0) {
    return Array.from({ length: count }, () => ({ params: {}, categories: {} }));
  }

  const valuePools: Record<string, GeneratedValue<unknown>[]> = {};
  for (const name of paramNames) {
    valuePools[name] = generateValuesForParam(endpoint.params[name], count);
  }

  const cases: TestCase[] = [];
  for (let i = 0; i < count; i++) {
    const params: Record<string, unknown> = {};
    const categories: Record<string, CaseCategory> = {};

    for (const name of paramNames) {
      const generated = valuePools[name][i];
      params[name] = generated.value;
      categories[name] = generated.category;
    }

    cases.push({ params, categories });
  }

  return cases;
}
// Runs the normal deterministic case generation, then optionally appends
// AI-suggested edge cases per param. Only called when the user explicitly
// opts in (e.g. via a CLI flag) — buildCases() itself is untouched and
// remains fully synchronous/offline for everyone else.
export async function buildCasesWithAiSuggestions(endpoint: EndpointConfig): Promise<TestCase[]> {
  const baseCases = buildCases(endpoint);
  const paramNames = Object.keys(endpoint.params);

  if (paramNames.length === 0) return baseCases;

  // pick one "typical" valid value per param, to fill in the params we're
  // NOT specifically testing an AI suggestion for in a given case
  const typicalValues: Record<string, unknown> = {};
  for (const name of paramNames) {
    typicalValues[name] = baseCases[0]?.params[name];
  }

  const aiCases: TestCase[] = [];

  for (const name of paramNames) {
    let suggestions;
    try {
      suggestions = await suggestEdgeCases({ paramName: name, param: endpoint.params[name] });
    } catch (err) {
      // AI-assist must never break a fuzz run — if it fails for any reason
      // (no API key, network issue, etc.), just skip it for this param
      console.log(`  ⚠️  Could not get AI-suggested edge cases for "${name}": ${err instanceof Error ? err.message : err}`);
      continue;
    }

    for (const suggestion of suggestions) {
      const params = { ...typicalValues, [name]: suggestion.value };
      const categories: Record<string, CaseCategory> = {};
      for (const n of paramNames) {
        categories[n] = n === name ? suggestion.category : "valid";
      }
      aiCases.push({ params, categories });
    }
  }

  return [...baseCases, ...aiCases];
}