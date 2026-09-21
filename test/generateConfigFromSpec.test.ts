import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs/promises";

const CACHE_DIR = ".retrospecs-cache";

afterEach(async () => {
  await fs.rm(CACHE_DIR, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.resetModules(); // clear Node's module cache so each test gets a fresh import
});

describe("generateConfigFromSpec", () => {
  it("returns a valid config when Gemini produces well-formed output", async () => {
    vi.doMock("../src/ai-assist/client", () => ({
      callGemini: vi.fn().mockResolvedValue({
        baseUrl: "http://localhost:4000",
        endpoints: [
          {
            name: "getUser",
            method: "GET",
            path: "/users",
            params: [{ name: "id", type: "number", min: 1, max: 9999 }],
          },
        ],
      }),
    }));

    const { generateConfigFromSpec } = await import("../src/ai-assist/generateConfigFromSpec");
    const config = await generateConfigFromSpec({
      description: "GET /users takes an id between 1 and 9999",
      baseUrl: "http://localhost:4000",
    });

    expect(config.baseUrl).toBe("http://localhost:4000");
    expect(config.endpoints[0].name).toBe("getUser");
    expect(config.endpoints[0].params.id.max).toBe(9999);

    vi.doUnmock("../src/ai-assist/client");
  });

  it("throws a clear error when Gemini produces invalid output", async () => {
    vi.doMock("../src/ai-assist/client", () => ({
      callGemini: vi.fn().mockResolvedValue({
        baseUrl: "not-a-valid-url", // deliberately invalid
        endpoints: [],
      }),
    }));

    const { generateConfigFromSpec } = await import("../src/ai-assist/generateConfigFromSpec");

    await expect(
      generateConfigFromSpec({
        description: "anything",
        baseUrl: "http://localhost:4000",
      })
    ).rejects.toThrow(/failed validation/);

    vi.doUnmock("../src/ai-assist/client");
  });
});