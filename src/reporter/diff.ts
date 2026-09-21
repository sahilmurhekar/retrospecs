import fs from "node:fs/promises";
import type { ValidatedResult } from "../validators/statusValidator.js";

export type DiffEntry = {
  params: Record<string, unknown>;
  baselineStatus: number;
  currentStatus: number;
};

export type DiffReport = {
  regressions: DiffEntry[]; // was passing in baseline, now failing
  improvements: DiffEntry[]; // was failing in baseline, now passing
  unchanged: number;
};

// Cases are matched between runs by their exact param values —
// sorted keys so { id: 1, x: 2 } and { x: 2, id: 1 } are treated as the same case.
function keyFor(params: Record<string, unknown>): string {
  return JSON.stringify(params, Object.keys(params).sort());
}

export function diffResults(
  baseline: ValidatedResult[],
  current: ValidatedResult[]
): DiffReport {
  const baselineMap = new Map<string, ValidatedResult>();
  for (const r of baseline) {
    baselineMap.set(keyFor(r.params), r);
  }

  const regressions: DiffEntry[] = [];
  const improvements: DiffEntry[] = [];
  let unchanged = 0;

  for (const cur of current) {
    const base = baselineMap.get(keyFor(cur.params));
    if (!base) continue; // case wasn't in the baseline run — nothing to compare

    if (base.pass === cur.pass) {
      unchanged++;
      continue;
    }

    const entry: DiffEntry = {
      params: cur.params,
      baselineStatus: base.status,
      currentStatus: cur.status,
    };

    if (base.pass && !cur.pass) regressions.push(entry);
    else improvements.push(entry);
  }

  return { regressions, improvements, unchanged };
}

export async function saveBaseline(results: ValidatedResult[], filePath: string): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(results, null, 2));
}

export async function loadBaseline(filePath: string): Promise<ValidatedResult[]> {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
}