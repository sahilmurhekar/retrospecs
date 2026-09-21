import { describe, it, expect } from "vitest";
import { runWithConcurrencyLimit } from "../src/runner/concurrencyPool";

describe("runWithConcurrencyLimit", () => {
  it("processes every item and preserves order", async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await runWithConcurrencyLimit(items, 2, async (n) => n * 10);
    expect(results).toEqual([10, 20, 30, 40, 50]);
  });

  it("never runs more than `limit` tasks concurrently", async () => {
    let active = 0;
    let maxActive = 0;
    const items = Array.from({ length: 20 }, (_, i) => i);

    await runWithConcurrencyLimit(items, 3, async (n) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return n;
    });

    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it("handles an empty items list", async () => {
    const results = await runWithConcurrencyLimit([], 5, async (n) => n);
    expect(results).toEqual([]);
  });
});