import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildCases } from "../src/runner/caseBuilder";
import type { EndpointConfig } from "../src/config/schema";

describe("buildCases", () => {
  it("builds the requested number of cases for a single-param endpoint", () => {
    const endpoint: EndpointConfig = {
      name: "getUser",
      method: "GET",
      path: "/users/:id",
      params: { id: { type: "number", min: 1, max: 100 } },
      testCount: 25,
    };
    const cases = buildCases(endpoint);
    expect(cases.length).toBe(25);
    expect(cases[0].params).toHaveProperty("id");
    expect(cases[0].categories).toHaveProperty("id");
  });

  it("builds cases with all params present for a multi-param endpoint", () => {
    const endpoint: EndpointConfig = {
      name: "search",
      method: "GET",
      path: "/products",
      params: {
        page: { type: "number", min: 1, max: 10 },
        limit: { type: "number", min: 1, max: 50 },
      },
      testCount: 10,
    };
    const cases = buildCases(endpoint);
    expect(cases.length).toBe(10);
    cases.forEach((c) => {
      expect(c.params).toHaveProperty("page");
      expect(c.params).toHaveProperty("limit");
      expect(c.categories).toHaveProperty("page");
      expect(c.categories).toHaveProperty("limit");
    });
  });

  it("handles an endpoint with no params", () => {
    const endpoint: EndpointConfig = {
      name: "health",
      method: "GET",
      path: "/health",
      params: {},
      testCount: 5,
    };
    const cases = buildCases(endpoint);
    expect(cases.length).toBe(5);
    expect(cases[0].params).toEqual({});
    expect(cases[0].categories).toEqual({});
  });

  it("correctly tags a boundary-low value's category", () => {
    const endpoint: EndpointConfig = {
      name: "getUser",
      method: "GET",
      path: "/users/:id",
      params: { id: { type: "number", min: 5, max: 100 } },
      testCount: 10,
    };
    const cases = buildCases(endpoint);
    const boundaryLowCase = cases.find((c) => c.params.id === 4); // min - 1
    expect(boundaryLowCase?.categories.id).toBe("boundary-low");
  });
    it("supports string params without throwing", () => {
    const endpoint: EndpointConfig = {
      name: "createUser",
      method: "GET",
      path: "/users",
      params: { name: { type: "string", min: 1, max: 20 } },
      testCount: 10,
    };
    const cases = buildCases(endpoint);
    expect(cases.length).toBe(10);
    expect(typeof cases[0].params.name).toBe("string");
  });

  it("supports boolean params without throwing", () => {
    const endpoint: EndpointConfig = {
      name: "toggleFeature",
      method: "GET",
      path: "/feature",
      params: { enabled: { type: "boolean" } },
      testCount: 10,
    };
    const cases = buildCases(endpoint);
    expect(cases.length).toBe(10);
    expect(typeof cases[0].params.enabled).toBe("boolean");
  });
describe("buildCasesWithAiSuggestions", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("appends AI-suggested cases on top of the normal deterministic ones", async () => {
    vi.doMock("../src/ai-assist/suggestEdgeCases", () => ({
      suggestEdgeCases: vi.fn().mockResolvedValue([
        { value: -1, category: "valid" },
        { value: 999999, category: "valid" },
      ]),
    }));

    const { buildCasesWithAiSuggestions } = await import("../src/runner/caseBuilder");
    const endpoint: EndpointConfig = {
      name: "getUser",
      method: "GET",
      path: "/users",
      params: { id: { type: "number", min: 1, max: 100 } },
      testCount: 10,
    };

    const cases = await buildCasesWithAiSuggestions(endpoint);
    expect(cases.length).toBe(12); // 10 deterministic + 2 AI-suggested
  });

  it("continues gracefully if AI suggestions fail (e.g. no API key)", async () => {
    vi.doMock("../src/ai-assist/suggestEdgeCases", () => ({
      suggestEdgeCases: vi.fn().mockRejectedValue(new Error("no API key")),
    }));

    const { buildCasesWithAiSuggestions } = await import("../src/runner/caseBuilder");
    const endpoint: EndpointConfig = {
      name: "getUser",
      method: "GET",
      path: "/users",
      params: { id: { type: "number", min: 1, max: 100 } },
      testCount: 10,
    };

    const cases = await buildCasesWithAiSuggestions(endpoint);
    expect(cases.length).toBe(10); // just the deterministic cases, no crash
  });
});
});