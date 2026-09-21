import { describe, it, expect } from "vitest";
import { generateBooleanCases } from "../src/generators/boolean";

describe("generateBooleanCases", () => {
  it("returns exactly the requested count", () => {
    const cases = generateBooleanCases(10);
    expect(cases.length).toBe(10);
  });

  it("includes both true and false", () => {
    const cases = generateBooleanCases(10);
    const values = cases.map((c) => c.value);
    expect(values).toContain(true);
    expect(values).toContain(false);
  });

  it("tags every case as valid", () => {
    const cases = generateBooleanCases(5);
    cases.forEach((c) => expect(c.category).toBe("valid"));
  });
});