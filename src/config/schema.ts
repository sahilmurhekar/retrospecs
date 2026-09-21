import { z } from "zod";

// A single parameter's rules — e.g. "id must be a number between 1 and 9999"
const paramSchema = z.object({
  type: z.enum(["string", "number", "boolean"]),
  min: z.number().optional(),
  max: z.number().optional(),
});
// Describes how to authenticate outgoing requests.
// Two modes: a static header value, OR a login request that returns a token.
const authSchema = z.object({
  // static mode: attach this header (e.g. "Authorization") with this value
  // to every request. Use this when you already have a long-lived token.
  header: z.string().optional(),
  value: z.string().optional(),

  // dynamic mode: fetch a token once via a login request before the run,
  // then attach it as a Bearer token to every request.
  login: z
    .object({
      path: z.string(),
      method: z.enum(["GET", "POST"]).default("POST"),
      body: z.record(z.string(), z.unknown()).optional(),
      tokenField: z.string().default("token"), // which field in the login response holds the token
    })
    .optional(),
}).refine(
  (data) => (data.header && data.value) || data.login,
  { message: "auth requires either both 'header' and 'value', or a 'login' block" }
);

// One endpoint to test — e.g. GET /users/:id
// Describes a cleanup step to run after each mutation test case —
// e.g. deleting a record that was just created, using a value from the response.
const cleanupSchema = z.object({
  path: z.string(), // may contain "{{responseField}}" as a placeholder
  method: z.enum(["DELETE", "POST"]).default("DELETE"),
  responseField: z.string().default("id"), // which field in the response to extract for the placeholder
});

export const endpointSchema = z
  .object({
    name: z.string().min(1, "endpoint name cannot be empty"),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    path: z.string().min(1, "path cannot be empty"),
    params: z.record(z.string(), paramSchema).default({}),
    testCount: z.number().int().positive().default(150),
    // only meaningful for mutating methods — see refine() below
    allowMutations: z.boolean().default(false),
    cleanup: cleanupSchema.optional(),
    // GET params default to query string; mutating methods default to a JSON body
    paramLocation: z.enum(["query", "body"]).optional(),
  })
  .refine(
    (data) => data.method === "GET" || data.allowMutations,
    {
      message:
        "Mutating methods (POST/PUT/PATCH/DELETE) require 'allowMutations: true' to be set explicitly on the endpoint.",
    }
  )
  .refine(
    (data) => data.method === "GET" || !!data.cleanup,
    {
      message:
        "Mutating methods require a 'cleanup' block, so fuzz test data doesn't accumulate in your database.",
    }
  );

// The whole config file — a base URL + a list of endpoints
export const configSchema = z.object({
  baseUrl: z.string().url("baseUrl must be a valid URL, e.g. http://localhost:3000"),
  auth: authSchema.optional(),
  endpoints: z.array(endpointSchema).min(1, "at least one endpoint is required"),
});

// TypeScript types derived automatically from the schemas above —
// one definition, used for both runtime validation and compile-time types
export type AuthConfig = z.infer<typeof authSchema>;
export type EndpointConfig = z.infer<typeof endpointSchema>;
export type CleanupConfig = z.infer<typeof cleanupSchema>;
export type ParamConfig = z.infer<typeof paramSchema>;
export type FuzzConfig = z.infer<typeof configSchema>;