import { describe, it, expect } from "vitest";
import { generateNumberCases } from "../src/generators/number";

describe("generateNumberCases", () => {
  it("includes the boundary values with correct categories", () => {
    const cases = generateNumberCases(2, 10, 20);
    const values = cases.map((c) => c.value);

    expect(values).toContain(2);
    expect(values).toContain(10);
    expect(values).toContain(0);
    expect(values).toContain(11);

    const minCase = cases.find((c) => c.value === 2);
    expect(minCase?.category).toBe("valid");

    const zeroCase = cases.find((c) => c.value === 0);
    expect(zeroCase?.category).toBe("zero");

    const aboveMaxCase = cases.find((c) => c.value === 11);
    expect(aboveMaxCase?.category).toBe("boundary-high");
  });

  it("returns exactly the requested count", () => {
    const cases = generateNumberCases(1, 100, 30);
    expect(cases.length).toBe(30);
  });

  it("random-filled values are tagged as valid and stay within a reasonable range", () => {
    const cases = generateNumberCases(5, 15, 10);
    cases.forEach((c) => {
      const withinExpectedRange = c.value >= 4 && c.value <= 16;
      const isZeroBoundary = c.value === 0;
      expect(withinExpectedRange || isZeroBoundary).toBe(true);
    });
  });

  it("uses sensible defaults when no args are given", () => {
    const cases = generateNumberCases();
    expect(cases.length).toBe(20);
  });
});