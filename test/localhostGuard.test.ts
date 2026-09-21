import { describe, it, expect } from "vitest";
import { assertLocalhost } from "../src/runner/localhostGuard";

describe("assertLocalhost", () => {
  it("allows http://localhost", async () => {
    await expect(assertLocalhost("http://localhost:3000")).resolves.not.toThrow();
  });

  it("allows 127.0.0.1 directly", async () => {
    await expect(assertLocalhost("http://127.0.0.1:3000")).resolves.not.toThrow();
  });

  it("rejects an external domain", async () => {
    await expect(assertLocalhost("http://example.com")).rejects.toThrow();
  });

  it("rejects an unresolvable hostname", async () => {
    await expect(
      assertLocalhost("http://this-domain-should-not-exist-12345.test")
    ).rejects.toThrow();
  });
});