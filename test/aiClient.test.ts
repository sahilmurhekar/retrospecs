import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("callGemini", () => {
  const originalKey = process.env.GEMINI_API_KEY;

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it("throws AiAssistDisabledError when no API key is set", async () => {
    delete process.env.GEMINI_API_KEY;

    // re-import fresh so the module doesn't cache old env state
    const { callGemini, AiAssistDisabledError } = await import("../src/ai-assist/client");

    await expect(
      callGemini({ prompt: "test", responseSchema: {} })
    ).rejects.toThrow(AiAssistDisabledError);
  });

  it("throws a clear error message mentioning how to fix it", async () => {
    delete process.env.GEMINI_API_KEY;
    const { callGemini } = await import("../src/ai-assist/client");

    await expect(
      callGemini({ prompt: "test", responseSchema: {} })
    ).rejects.toThrow(/GEMINI_API_KEY/);
  });
});