# Config file reference

Every `retrospecs` run starts from a single JSON config file. This is the one thing you maintain by hand (or generate with `retrospecs init`) — it's validated against a Zod schema on load, so a malformed config fails immediately with a readable error rather than crashing mid-run.

Three worked examples live in [`examples/configs/`](../examples/configs/): `basic.config.json`, `auth.config.json`, and `mutation.config.json`. This doc covers every field in the schema.

## Top level

```json
{
  "baseUrl": "http://localhost:4000",
  "auth": { ... },
  "endpoints": [ ... ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `baseUrl` | `string` (URL) | yes | Must be a valid URL. Its hostname is DNS-resolved before every run — if it doesn't resolve to `127.0.0.1`/`::1`, the run refuses to start. |
| `auth` | object | no | See [Auth](#auth) below. Omit entirely if your API needs no authentication. |
| `endpoints` | array | yes, min 1 | One entry per endpoint you want fuzzed. See [Endpoints](#endpoints). |

## Endpoints

Each entry in `endpoints` describes one route to fuzz:

```json
{
  "name": "getUser",
  "method": "GET",
  "path": "/users",
  "params": {
    "id": { "type": "number", "min": 1, "max": 9999 }
  },
  "testCount": 200,
  "allowMutations": false,
  "cleanup": { ... },
  "paramLocation": "query"
}
```

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `name` | `string` | yes | — | Non-empty. Used as the label in reports and as the subfolder name under `fuzz-results/`. |
| `method` | `"GET" \| "POST" \| "PUT" \| "PATCH" \| "DELETE"` | yes | — | |
| `path` | `string` | yes | — | Non-empty. Appended to `baseUrl`. |
| `params` | object of `paramName → paramSchema` | no | `{}` | See [Params](#params). |
| `testCount` | positive integer | no | `150` | How many fuzz cases to generate for this endpoint. |
| `allowMutations` | `boolean` | no | `false` | **Required to be `true`** for any non-`GET` method — see [Mutation rules](#mutation-rules). |
| `cleanup` | object | only for mutating endpoints | — | See [Cleanup](#cleanup). |
| `paramLocation` | `"query" \| "body"` | no | query string for `GET`, JSON body for mutating methods | Override if your API doesn't follow that convention. |

### Params

Each key in `params` describes one parameter's fuzzing rules:

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | `"string" \| "number" \| "boolean"` | yes | Determines which generator(s) run for this param. |
| `min` | `number` | no | Lower bound for boundary-value generation (numbers) or length (strings). |
| `max` | `number` | no | Upper bound, same rules as `min`. |

The generator still produces missing-value, wrong-type, and extreme-value cases regardless of `min`/`max` — those bounds only tune the boundary and random-valid cases.

### Mutation rules

Two validation rules are enforced on every endpoint, non-negotiably:

1. **Any method other than `GET` requires `allowMutations: true`.** This has to be set explicitly per endpoint — there's no global switch. The point is to make it impossible to accidentally fuzz a `DELETE` route.
2. **Any method other than `GET` requires a `cleanup` block.** Without one, fuzz-generated records would silently pile up in whatever database your local server is backed by.

Both are checked at config-load time, before any request is sent — you'll get a clear Zod error naming the offending endpoint rather than a mid-run surprise.

### Cleanup

Describes how to undo a mutation after each test case that returns a `2xx` status:

```json
"cleanup": {
  "path": "/mutable-users/{{responseField}}",
  "method": "DELETE",
  "responseField": "id"
}
```

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `path` | `string` | yes | — | May contain `{{responseField}}` as a placeholder, substituted with the extracted value. |
| `method` | `"DELETE" \| "POST"` | no | `"DELETE"` | |
| `responseField` | `string` | no | `"id"` | Which field to pull out of the mutation's response body and substitute into `path`. |

If a cleanup request fails, the run doesn't stop — it's logged as a warning (`cleanup failed`) so you know test data may have been left behind, and the failure count is reported at the end.

## Auth

Two mutually exclusive modes — pick one:

**Static mode** — attach the same header to every request:

```json
"auth": {
  "header": "Authorization",
  "value": "Bearer some-long-lived-token"
}
```

**Login mode** — fetch a token once before the run, then attach it as a Bearer token to every request:

```json
"auth": {
  "login": {
    "path": "/login",
    "method": "POST",
    "body": { "username": "testuser" },
    "tokenField": "token"
  }
}
```

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `header` | `string` | static mode only | — | Must be paired with `value`. |
| `value` | `string` | static mode only | — | Must be paired with `header`. |
| `login.path` | `string` | login mode only | — | Endpoint to POST/GET to obtain a token. |
| `login.method` | `"GET" \| "POST"` | no | `"POST"` | |
| `login.body` | object | no | — | Request body sent to the login endpoint. |
| `login.tokenField` | `string` | no | `"token"` | Field in the login response holding the token. |

You must supply either both `header` and `value`, or a `login` block — the schema rejects a config with neither (or a mix that doesn't satisfy one full mode).

## Full worked example (mutation + cleanup)

```json
{
  "baseUrl": "http://localhost:4000",
  "endpoints": [
    {
      "name": "createMutableUser",
      "method": "POST",
      "path": "/mutable-users",
      "params": {
        "name": { "type": "string", "min": 1, "max": 20 }
      },
      "testCount": 10,
      "allowMutations": true,
      "cleanup": {
        "path": "/mutable-users/{{responseField}}",
        "method": "DELETE",
        "responseField": "id"
      }
    }
  ]
}
```