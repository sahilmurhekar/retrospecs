import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs/promises";
import { getCached, setCached, withCache } from "../src/ai-assist/cache";

const CACHE_DIR = ".retrospecs-cache";

afterEach(async () => {
  await fs.rm(CACHE_DIR, { recursive: true, force: true });
});

describe("getCached / setCached", () => {
  it("returns null when nothing is cached yet", async () => {
    const result = await getCached("testFn", { a: 1 });
    expect(result).toBeNull();
  });

  it("stores and retrieves a value correctly", async () => {
    await setCached("testFn", { a: 1 }, { result: "hello" });
    const result = await getCached("testFn", { a: 1 });
    expect(result).toEqual({ result: "hello" });
  });

  it("treats differently-ordered keys as the same cache entry", async () => {
    await setCached("testFn", { a: 1, b: 2 }, { result: "cached" });
    const result = await getCached("testFn", { b: 2, a: 1 });
    expect(result).toEqual({ result: "cached" });
  });

  it("treats genuinely different inputs as different cache entries", async () => {
    await setCached("testFn", { a: 1 }, { result: "first" });
    const result = await getCached("testFn", { a: 2 });
    expect(result).toBeNull();
  });
});

describe("withCache", () => {
  it("only calls the wrapped function once for repeated identical input", async () => {
    let callCount = 0;
    const wrapped = withCache("countedFn", async (input: { x: number }) => {
      callCount++;
      return { doubled: input.x * 2 };
    });

    const first = await wrapped({ x: 5 });
    const second = await wrapped({ x: 5 });

    expect(first).toEqual({ doubled: 10 });
    expect(second).toEqual({ doubled: 10 });
    expect(callCount).toBe(1); // the real function only ran once
  });

  it("calls the wrapped function again for different input", async () => {
    let callCount = 0;
    const wrapped = withCache("countedFn2", async (input: { x: number }) => {
      callCount++;
      return { doubled: input.x * 2 };
    });

    await wrapped({ x: 5 });
    await wrapped({ x: 6 });

    expect(callCount).toBe(2);
  });
});