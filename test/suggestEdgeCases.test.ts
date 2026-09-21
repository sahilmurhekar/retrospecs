import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";

const CACHE_DIR = ".retrospecs-cache";

beforeEach(async () => {
  await fs.rm(CACHE_DIR, { recursive: true, force: true });
  vi.resetModules();
});

afterEach(async () => {
  await fs.rm(CACHE_DIR, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("suggestEdgeCases", () => {
  it("tags a rejection-expected number suggestion as boundary-high", async () => {
    vi.doMock("../src/ai-assist/client", () => ({
      callGemini: vi.fn().mockResolvedValue({
        suggestions: [{ value: "-1", expectRejection: true }],
      }),
    }));

    const { suggestEdgeCases } = await import("../src/ai-assist/suggestEdgeCases");
    const result = await suggestEdgeCases({
      paramName: "page",
      param: { type: "number", min: 1, max: 20 },
    });

    expect(result[0].value).toBe(-1);
    expect(result[0].category).toBe("boundary-high");
  });

  it("tags an accept-expected string suggestion as valid", async () => {
    vi.doMock("../src/ai-assist/client", () => ({
      callGemini: vi.fn().mockResolvedValue({
        suggestions: [{ value: "<script>alert(1)</script>", expectRejection: false }],
      }),
    }));

    const { suggestEdgeCases } = await import("../src/ai-assist/suggestEdgeCases");
    const result = await suggestEdgeCases({
      paramName: "search",
      param: { type: "string" },
    });

    expect(result[0].value).toBe("<script>alert(1)</script>");
    expect(result[0].category).toBe("valid");
  });

  it("converts boolean suggestions correctly", async () => {
    vi.doMock("../src/ai-assist/client", () => ({
      callGemini: vi.fn().mockResolvedValue({
        suggestions: [{ value: "true", expectRejection: false }],
      }),
    }));

    const { suggestEdgeCases } = await import("../src/ai-assist/suggestEdgeCases");
    const result = await suggestEdgeCases({
      paramName: "enabled",
      param: { type: "boolean" },
    });

    expect(result[0].value).toBe(true);
  });
});