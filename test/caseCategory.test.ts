import { describe, it, expect } from "vitest";
import { expectedOutcomeFor } from "../src/generators/caseCategory";

describe("expectedOutcomeFor", () => {
  it("expects valid cases to succeed", () => {
    expect(expectedOutcomeFor("valid")).toBe("success");
  });

  it("expects boundary-low cases to be rejected", () => {
    expect(expectedOutcomeFor("boundary-low")).toBe("rejection");
  });

  it("expects boundary-high cases to be rejected", () => {
    expect(expectedOutcomeFor("boundary-high")).toBe("rejection");
  });

  it("expects missing cases to be rejected", () => {
    expect(expectedOutcomeFor("missing")).toBe("rejection");
  });

  it("treats zero as an expected rejection by default", () => {
    expect(expectedOutcomeFor("zero")).toBe("rejection");
  });
});