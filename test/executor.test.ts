import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { EndpointConfig } from "../src/config/schema";
import type { TestCase } from "../src/runner/caseBuilder";
import { runCase, buildAuthHeaders } from "../src/runner/executor";


let server: Server;
const PORT = 4123;
const BASE_URL = `http://localhost:${PORT}`;

beforeAll(() => {
  const app = express();

  app.get("/users", (req, res) => {
    const id = Number(req.query.id);
    if (id < 1) {
      res.status(400).json({ error: "id must be positive" });
    } else {
      res.status(200).json({ id, name: "Test User" });
    }
  });

  app.get("/slow", (_req, res) => {
    setTimeout(() => res.status(200).json({ ok: true }), 10000);
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

describe("runCase with mutating methods", () => {
  let mutServer: Server;
  const MUT_PORT = 4126;
  const MUT_BASE_URL = `http://localhost:${MUT_PORT}`;

  beforeAll(() => {
    const mutApp = express();
    mutApp.use(express.json());

    mutApp.post("/users", (req, res) => {
      res.status(201).json({ id: 999, name: req.body.name ?? "unnamed" });
    });

    return new Promise<void>((resolve) => {
      mutServer = mutApp.listen(MUT_PORT, () => resolve());
    });
  });

  afterAll(() => {
    return new Promise<void>((resolve) => {
      mutServer.close(() => resolve());
    });
  });

  it("sends params as a JSON body for POST requests", async () => {
    const endpoint: EndpointConfig = {
      name: "createUser",
      method: "POST",
      path: "/users",
      params: { name: { type: "string" } },
      testCount: 1,
      allowMutations: true,
      cleanup: { path: "/users/{{responseField}}", method: "DELETE", responseField: "id" },
    };
    const testCase: TestCase = { params: { name: "Alice" }, categories: { name: "valid" } };

    const result = await runCase(MUT_BASE_URL, endpoint, testCase);
    expect(result.status).toBe(201);
    expect(result.responseBody).toEqual({ id: 999, name: "Alice" });
  });
});

describe("runCase", () => {
  const endpoint: EndpointConfig = {
    name: "getUser",
    method: "GET",
    path: "/users",
    params: { id: { type: "number", min: 1, max: 100 } },
    testCount: 10,
  };

  it("returns status 200 for a valid request", async () => {
    const testCase: TestCase = { params: { id: 5 }, categories: { id: "valid" } };
    const result = await runCase(BASE_URL, endpoint, testCase);
    expect(result.status).toBe(200);
    expect(result.error).toBeUndefined();
  });

  it("returns status 400 for an invalid id", async () => {
    const testCase: TestCase = { params: { id: -1 }, categories: { id: "boundary-low" } };
    const result = await runCase(BASE_URL, endpoint, testCase);
    expect(result.status).toBe(400);
  });

  it("records latency as a positive number", async () => {
    const testCase: TestCase = { params: { id: 5 }, categories: { id: "valid" } };
    const result = await runCase(BASE_URL, endpoint, testCase);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("handles a timeout without throwing", async () => {
    const slowEndpoint: EndpointConfig = { ...endpoint, path: "/slow", params: {} };
    const testCase: TestCase = { params: {}, categories: {} };
    const result = await runCase(BASE_URL, slowEndpoint, testCase);
    expect(result.status).toBe(0);
    expect(result.error).toBeDefined();
  }, 8000);

  it("carries the category info through to the result", async () => {
    const testCase: TestCase = { params: { id: 5 }, categories: { id: "valid" } };
    const result = await runCase(BASE_URL, endpoint, testCase);
    expect(result.categories.id).toBe("valid");
  });
    describe("buildAuthHeaders", () => {
  it("returns empty headers when no auth is configured", () => {
    const headers = buildAuthHeaders(undefined, undefined);
    expect(headers).toEqual({});
  });

  it("returns the static header/value when configured", () => {
    const headers = buildAuthHeaders(
      { header: "Authorization", value: "Bearer abc123" },
      undefined
    );
    expect(headers).toEqual({ Authorization: "Bearer abc123" });
  });

  it("returns a Bearer token header when login mode is used with a resolved token", () => {
    const headers = buildAuthHeaders(
      { login: { path: "/login", method: "POST", tokenField: "token" } },
      "resolved-jwt-token"
    );
    expect(headers).toEqual({ Authorization: "Bearer resolved-jwt-token" });
  });

  it("returns empty headers if login mode is configured but no token was resolved yet", () => {
    const headers = buildAuthHeaders(
      { login: { path: "/login", method: "POST", tokenField: "token" } },
      undefined
    );
    expect(headers).toEqual({});
  });
});
});
