import type { GeneratedValue } from "./caseCategory.js";
import { random } from "../runner/rng.js";

const EXTREME_LONG_STRING = "x".repeat(5000);
const REALISTIC_SAMPLES = [
  "hello world",
  "test@example.com",
  "unicode-🎉-test",
  "special!@#$%^&*()chars",
  "  leading and trailing spaces  ",
];

export function generateStringCases(
  minLen: number = 0,
  maxLen: number = 50,
  count: number = 20
): GeneratedValue<string>[] {
  const boundaryCases: GeneratedValue<string>[] = [
    { value: "a".repeat(Math.max(minLen, 1)), category: "valid" },
    { value: "a".repeat(maxLen), category: "valid" },
    { value: "", category: minLen > 0 ? "boundary-low" : "zero" },
    { value: "a".repeat(maxLen + 1), category: "boundary-high" },
    { value: EXTREME_LONG_STRING, category: "boundary-high" },
  ];

  const seen = new Set<string>();
  const cases: GeneratedValue<string>[] = [];
  for (const c of boundaryCases) {
    if (!seen.has(c.value)) {
      seen.add(c.value);
      cases.push(c);
    }
  }

  let i = 0;
  while (cases.length < count) {
    const sample = REALISTIC_SAMPLES[i % REALISTIC_SAMPLES.length];
    const randomLen = Math.floor(random() * (maxLen - minLen + 1)) + minLen;
    const trimmed = sample.slice(0, Math.max(randomLen, 1)) || "x";
    cases.push({ value: trimmed, category: "valid" });
    i++;
  }

  return cases;
}