import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const CACHE_DIR = ".retrospecs-cache";

function hashInput(input: unknown): string {
  const serialized = JSON.stringify(input, Object.keys(input as object).sort());
  return crypto.createHash("sha256").update(serialized).digest("hex");
}

function cacheFilePath(functionName: string, input: unknown): string {
  const hash = hashInput(input);
  return path.join(CACHE_DIR, `${functionName}-${hash}.json`);
}

export async function getCached<T>(functionName: string, input: unknown): Promise<T | null> {
  const filePath = cacheFilePath(functionName, input);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null; // no cache entry — that's fine, not an error
  }
}

export async function setCached<T>(functionName: string, input: unknown, value: T): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const filePath = cacheFilePath(functionName, input);
  await fs.writeFile(filePath, JSON.stringify(value, null, 2));
}

// wraps any async function with caching — call the wrapped version instead
// of the raw one, and repeated identical calls will skip the network entirely
export function withCache<TInput, TOutput>(
  functionName: string,
  fn: (input: TInput) => Promise<TOutput>
): (input: TInput) => Promise<TOutput> {
  return async (input: TInput) => {
    const cached = await getCached<TOutput>(functionName, input);
    if (cached !== null) {
      return cached;
    }
    const result = await fn(input);
    await setCached(functionName, input, result);
    return result;
  };
}