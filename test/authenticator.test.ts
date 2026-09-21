import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { resolveAuthToken } from "../src/runner/authenticator";

let server: Server;
const PORT = 4125;
const BASE_URL = `http://localhost:${PORT}`;

beforeAll(() => {
  const app = express();
  app.use(express.json());

  app.post("/login", (req, res) => {
    if (req.body.username === "admin") {
      res.status(200).json({ token: "fake-jwt-abc123" });
    } else {
      res.status(401).json({ error: "invalid credentials" });
    }
  });

  app.post("/login-weird-shape", (_req, res) => {
    res.status(200).json({ accessToken: "different-field-name" });
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

describe("resolveAuthToken", () => {
  it("returns undefined when no auth is configured", async () => {
    const token = await resolveAuthToken(BASE_URL, undefined);
    expect(token).toBeUndefined();
  });

  it("returns undefined when auth uses static mode, not login", async () => {
    const token = await resolveAuthToken(BASE_URL, {
      header: "Authorization",
      value: "Bearer static-token",
    });
    expect(token).toBeUndefined();
  });

  it("fetches and returns a token on successful login", async () => {
    const token = await resolveAuthToken(BASE_URL, {
      login: { path: "/login", method: "POST", body: { username: "admin" }, tokenField: "token" },
    });
    expect(token).toBe("fake-jwt-abc123");
  });

  it("throws a clear error when login returns a non-2xx status", async () => {
    await expect(
      resolveAuthToken(BASE_URL, {
        login: { path: "/login", method: "POST", body: { username: "wrong" }, tokenField: "token" },
      })
    ).rejects.toThrow(/status 401/);
  });

  it("throws a clear error when the expected tokenField is missing", async () => {
    await expect(
      resolveAuthToken(BASE_URL, {
        login: { path: "/login-weird-shape", method: "POST", tokenField: "token" },
      })
    ).rejects.toThrow(/did not contain a string field named "token"/);
  });
});