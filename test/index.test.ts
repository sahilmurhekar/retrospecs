import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import express from "express";
import type { Server } from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { runFuzz } from "../src/index";
import type { FuzzConfig } from "../src/config/schema";

let server: Server;
const PORT = 4124;
const BASE_URL = `http://localhost:${PORT}`;
const OUT_DIR = path.join(process.cwd(), "test-output-e2e");

beforeAll(() => {
  const app = express();
  app.get("/users", (req, res) => {
    const id = Number(req.query.id);
    if (id >= 1 && id <= 9999) {
      res.status(200).json({ id, name: "Test User" });
    } else {
      res.status(400).json({ error: "invalid id" });
    }
  });
  return new Promise<void>((resolve) => {
    server = app.listen(PORT, () => resolve());
  });
});

afterAll(() => {
  return new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

afterEach(async () => {
  await fs.rm(OUT_DIR, { recursive: true, force: true });
});

describe("runFuzz (end-to-end)", () => {
  it("runs a full fuzz cycle and writes a report", async () => {
    const config: FuzzConfig = {
      baseUrl: BASE_URL,
      endpoints: [
        {
          name: "getUser",
          method: "GET",
          path: "/users",
          params: { id: { type: "number", min: 1, max: 9999 } },
          testCount: 20,
        },
      ],
    };

    await runFuzz(config, { outRoot: OUT_DIR });

    const summaryRaw = await fs.readFile(
      path.join(OUT_DIR, "getUser", "summary.json"),
      "utf-8"
    );
    const summary = JSON.parse(summaryRaw);

    expect(summary.total).toBe(20);
    // with category-aware validation, a correctly-behaving server should pass ALL cases —
    // boundary cases that get correctly rejected now count as passes too
    expect(summary.passed).toBe(20);
    expect(summary.failed).toBe(0);
  });

  it("refuses to run against a non-localhost baseUrl", async () => {
    const config: FuzzConfig = {
      baseUrl: "http://example.com",
      endpoints: [
        { name: "x", method: "GET", path: "/x", params: {}, testCount: 5 },
      ],
    };
    await expect(runFuzz(config, OUT_DIR)).rejects.toThrow();
  });
});