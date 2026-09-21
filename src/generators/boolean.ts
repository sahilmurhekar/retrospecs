import type { GeneratedValue } from "./caseCategory.js";

// Booleans only have two real values, so we just alternate them
// to fill whatever count is requested — no meaningful "boundary" concept here.
export function generateBooleanCases(count: number = 20): GeneratedValue<boolean>[] {
  const cases: GeneratedValue<boolean>[] = [];
  for (let i = 0; i < count; i++) {
    cases.push({ value: i % 2 === 0, category: "valid" });
  }
  return cases;
}