import { describe, it, expect } from "vitest";
import { generateStringCases } from "../src/generators/string";

describe("generateStringCases", () => {
  it("includes an empty-string boundary case", () => {
    const cases = generateStringCases(1, 20, 15);
    const emptyCase = cases.find((c) => c.value === "");
    expect(emptyCase?.category).toBe("boundary-low");
  });

  it("includes an over-max-length boundary case", () => {
    const cases = generateStringCases(0, 10, 15);
    const overLong = cases.find((c) => c.value.length === 11);
    expect(overLong?.category).toBe("boundary-high");
  });

  it("includes an extreme long string case", () => {
    const cases = generateStringCases(0, 10, 15);
    const extreme = cases.find((c) => c.value.length > 1000);
    expect(extreme).toBeDefined();
    expect(extreme?.category).toBe("boundary-high");
  });

  it("returns exactly the requested count", () => {
    const cases = generateStringCases(0, 50, 25);
    expect(cases.length).toBe(25);
  });
});