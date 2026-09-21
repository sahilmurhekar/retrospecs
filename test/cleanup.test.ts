import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { runCleanup } from "../src/runner/cleanup";
import type { CleanupConfig } from "../src/config/schema";

let server: Server;
const PORT = 4127;
const BASE_URL = `http://localhost:${PORT}`;
const deletedIds: number[] = [];

beforeAll(() => {
  const app = express();
  app.delete("/users/:id", (req, res) => {
    deletedIds.push(Number(req.params.id));
    res.status(204).send();
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

describe("runCleanup", () => {
  const cleanupConfig: CleanupConfig = {
    path: "/users/{{responseField}}",
    method: "DELETE",
    responseField: "id",
  };

  it("successfully deletes using the extracted id", async () => {
    const result = await runCleanup(BASE_URL, cleanupConfig, { id: 42, name: "test" });
    expect(result.success).toBe(true);
    expect(deletedIds).toContain(42);
  });

  it("fails gracefully when the response body has no usable field", async () => {
    const result = await runCleanup(BASE_URL, cleanupConfig, { name: "no id here" });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no field named/);
  });

  it("fails gracefully when there's no response body at all", async () => {
    const result = await runCleanup(BASE_URL, cleanupConfig, undefined);
    expect(result.success).toBe(false);
  });

  it("fails gracefully but doesn't throw when the cleanup request itself errors", async () => {
    const badConfig: CleanupConfig = {
      path: "/nonexistent/{{responseField}}",
      method: "DELETE",
      responseField: "id",
    };
    const result = await runCleanup(BASE_URL, badConfig, { id: 1 });
    expect(result.success).toBe(false);
  });
});