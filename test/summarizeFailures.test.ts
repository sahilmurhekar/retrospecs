import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ValidatedResult } from "../src/validators/statusValidator";
import type { EndpointConfig } from "../src/config/schema";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

function makeFailure(overrides: Partial<ValidatedResult> = {}): ValidatedResult {
  return {
    status: 200,
    latencyMs: 1,
    params: { page: 21 },
    categories: { page: "boundary-high" },
    pass: false,
    expectedOutcome: "rejection",
    ...overrides,
  };
}

describe("summarizeFailures", () => {
  it("returns an instant clean summary when there are no failures", async () => {
    const { summarizeFailures } = await import("../src/ai-assist/summarizeFailures");
    const result = await summarizeFailures([]);
    expect(result.groups).toEqual([]);
    expect(result.overallSummary).toMatch(/no unexpected failures/i);
  });

  it("groups failures using Gemini's response", async () => {
    vi.doMock("../src/ai-assist/client", () => ({
      callGemini: vi.fn().mockResolvedValue({
        groups: [
          {
            title: "Missing upper-bound validation on page",
            explanation: "page > 20 is accepted when it should be rejected",
            likelyRealBug: true,
            affectedCaseCount: 1,
          },
        ],
        overallSummary: "Found 1 real bug: missing upper-bound check on page.",
      }),
    }));

    const { summarizeFailures } = await import("../src/ai-assist/summarizeFailures");
    const result = await summarizeFailures([makeFailure()]);

    expect(result.groups.length).toBe(1);
    expect(result.groups[0].likelyRealBug).toBe(true);
    expect(result.overallSummary).toMatch(/real bug/i);
  });

  it("caps the number of failures sent to Gemini at 30", async () => {
    const mockFn = vi.fn().mockResolvedValue({ groups: [], overallSummary: "ok" });
    vi.doMock("../src/ai-assist/client", () => ({ callGemini: mockFn }));

    const { summarizeFailures } = await import("../src/ai-assist/summarizeFailures");
    const manyFailures = Array.from({ length: 100 }, () => makeFailure());
    await summarizeFailures(manyFailures);

    const promptArg = mockFn.mock.calls[0][0].prompt as string;
    const embeddedJson = JSON.parse(promptArg.split("Failures:\n")[1]);
    expect(embeddedJson.length).toBe(30);
  });

  it("includes endpoint config context in the prompt when provided", async () => {
    const mockFn = vi.fn().mockResolvedValue({ groups: [], overallSummary: "ok" });
    vi.doMock("../src/ai-assist/client", () => ({ callGemini: mockFn }));

    const { summarizeFailures } = await import("../src/ai-assist/summarizeFailures");
    const endpoint: EndpointConfig = {
      name: "searchProducts",
      method: "GET",
      path: "/products",
      params: { page: { type: "number", min: 1, max: 20 } },
      testCount: 150,
      allowMutations: false,
    };

    await summarizeFailures([makeFailure()], endpoint);

    const promptArg = mockFn.mock.calls[0][0].prompt as string;
    expect(promptArg).toContain('"max": 20');
  });

  it("does not include config context when no endpoint is provided", async () => {
    const mockFn = vi.fn().mockResolvedValue({ groups: [], overallSummary: "ok" });
    vi.doMock("../src/ai-assist/client", () => ({ callGemini: mockFn }));

    const { summarizeFailures } = await import("../src/ai-assist/summarizeFailures");
    await summarizeFailures([makeFailure()]);

    const promptArg = mockFn.mock.calls[0][0].prompt as string;
    expect(promptArg).not.toContain("declared valid parameter rules");
  });
});