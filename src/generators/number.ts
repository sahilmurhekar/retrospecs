import type { GeneratedValue } from "./caseCategory.js";
import { random } from "../runner/rng.js";

export function generateNumberCases(
  min: number = -100,
  max: number = 100,
  count: number = 20
): GeneratedValue<number>[] {
  const boundaryCases: GeneratedValue<number>[] = [
    { value: min, category: "valid" },
    { value: max, category: "valid" },
    { value: min - 1, category: "boundary-low" },
    { value: max + 1, category: "boundary-high" },
    { value: 0, category: "zero" },
  ];

  const seen = new Set<number>();
  const cases: GeneratedValue<number>[] = [];
  for (const c of boundaryCases) {
    if (!seen.has(c.value)) {
      seen.add(c.value);
      cases.push(c);
    }
  }

  while (cases.length < count) {
    const randomValue = Math.floor(random() * (max - min + 1)) + min;
    cases.push({ value: randomValue, category: "valid" });
  }

  return cases;
}