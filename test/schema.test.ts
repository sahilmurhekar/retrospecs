import { describe, it, expect } from "vitest";
import { configSchema } from "../src/config/schema";

describe("configSchema", () => {
  it("accepts a valid config", () => {
    const result = configSchema.parse({
      baseUrl: "http://localhost:3000",
      endpoints: [
        {
          name: "getUser",
          method: "GET",
          path: "/users/:id",
          params: { id: { type: "number", min: 1, max: 9999 } },
        },
      ],
    });
    expect(result.endpoints[0].testCount).toBe(150); // default applied
  });

  it("rejects a non-GET method", () => {
    expect(() =>
      configSchema.parse({
        baseUrl: "http://localhost:3000",
        endpoints: [{ name: "x", method: "POST", path: "/x" }],
      })
    ).toThrow();
  });
    it("still accepts a GET endpoint with no allowMutations or cleanup", () => {
    const result = configSchema.parse({
      baseUrl: "http://localhost:3000",
      endpoints: [{ name: "x", method: "GET", path: "/x" }],
    });
    expect(result.endpoints[0].allowMutations).toBe(false);
  });

  it("rejects a POST endpoint without allowMutations", () => {
    expect(() =>
      configSchema.parse({
        baseUrl: "http://localhost:3000",
        endpoints: [
          {
            name: "createUser",
            method: "POST",
            path: "/users",
            cleanup: { path: "/users/{{responseField}}" },
          },
        ],
      })
    ).toThrow(/allowMutations/);
  });

  it("rejects a POST endpoint without a cleanup block", () => {
    expect(() =>
      configSchema.parse({
        baseUrl: "http://localhost:3000",
        endpoints: [
          {
            name: "createUser",
            method: "POST",
            path: "/users",
            allowMutations: true,
          },
        ],
      })
    ).toThrow(/cleanup/);
  });

  it("accepts a properly configured POST endpoint with mutations allowed and cleanup defined", () => {
    const result = configSchema.parse({
      baseUrl: "http://localhost:3000",
      endpoints: [
        {
          name: "createUser",
          method: "POST",
          path: "/users",
          allowMutations: true,
          cleanup: { path: "/users/{{responseField}}", responseField: "id" },
        },
      ],
    });
    expect(result.endpoints[0].method).toBe("POST");
    expect(result.endpoints[0].cleanup?.method).toBe("DELETE"); // default applied
  });

  it("rejects a missing baseUrl", () => {
    expect(() =>
      configSchema.parse({
        endpoints: [{ name: "x", method: "GET", path: "/x" }],
      })
    ).toThrow();
  });
    it("accepts a config with static header auth", () => {
    const result = configSchema.parse({
      baseUrl: "http://localhost:3000",
      auth: { header: "Authorization", value: "Bearer abc123" },
      endpoints: [{ name: "x", method: "GET", path: "/x" }],
    });
    expect(result.auth?.header).toBe("Authorization");
  });

  it("accepts a config with a login block", () => {
    const result = configSchema.parse({
      baseUrl: "http://localhost:3000",
      auth: { login: { path: "/login", body: { username: "test" } } },
      endpoints: [{ name: "x", method: "GET", path: "/x" }],
    });
    expect(result.auth?.login?.path).toBe("/login");
    expect(result.auth?.login?.tokenField).toBe("token"); // default applied
    expect(result.auth?.login?.method).toBe("POST"); // default applied
  });

  it("rejects an auth block with neither header/value nor login", () => {
    expect(() =>
      configSchema.parse({
        baseUrl: "http://localhost:3000",
        auth: {},
        endpoints: [{ name: "x", method: "GET", path: "/x" }],
      })
    ).toThrow();
  });

  it("works fine with no auth block at all (backward compatible)", () => {
    const result = configSchema.parse({
      baseUrl: "http://localhost:3000",
      endpoints: [{ name: "x", method: "GET", path: "/x" }],
    });
    expect(result.auth).toBeUndefined();
  });

  it("rejects an invalid baseUrl", () => {
    expect(() =>
      configSchema.parse({
        baseUrl: "not-a-url",
        endpoints: [{ name: "x", method: "GET", path: "/x" }],
      })
    ).toThrow();
  });
});