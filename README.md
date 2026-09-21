# retrospecs

Fuzz-test your localhost API endpoints automatically — no more manually clicking through Postman requests.

## What it does

`retrospecs` reads a version-controlled config file describing your endpoints (base URL + params), auto-generates 100–200 fuzz test cases per endpoint (boundary values, random-valid values, wrong-type values, missing/extreme values), and fires them at your server to check response status codes. Every run is seeded, so failures are exactly reproducible with `--seed`, and you can save a baseline and diff future runs against it to catch regressions.

**Safety guarantee:** requests only ever go to `127.0.0.1` / `::1` / `localhost`. The target hostname is DNS-resolved (not string-matched) before every run, and anything that doesn't resolve to loopback is refused outright. Mutating methods (`POST`/`PUT`/`PATCH`/`DELETE`) are opt-in only — an endpoint must explicitly set `allowMutations: true` and provide a `cleanup` step, or the config fails validation before anything runs.

AI (Gemini Flash) is optional and only ever touches config-authoring and post-run summarization — never the test-execution loop itself. With no API key configured, every AI-assisted flag fails closed and the rest of the tool works exactly as if it weren't there.

## Install

Not published yet. For now, run it from a clone of this repo:

```bash
git clone <this-repo-url>
cd retrospecs
npm install
npm run dev -- run <configPath>   # equivalent to `tsx src/cli.ts run <configPath>`
```

Once published, this will be:

```bash
npx retrospecs run <configPath>
```

## Quick start

This repo ships a sample server and a couple of ready-made configs under `examples/`.

```bash
# terminal 1 — starts a throwaway Express server on http://localhost:4000
npm run sample-server

# terminal 2 — runs 200 fuzz cases each against GET /users and GET /products
npm run dev -- run examples/configs/basic.config.json
```

Results land in `./fuzz-results/<endpointName>/`:

- `results.json` — every individual test case and its outcome
- `summary.json` — pass/fail counts, average latency, a `byOutcome` breakdown, and an `unexpectedFailures` list

## CLI reference

### `retrospecs run <configPath>`

Runs a fuzz test suite from a config file.

| Flag | Description | Default |
|---|---|---|
| `-c, --concurrency <number>` | max concurrent requests | `10` |
| `-s, --seed <seed>` | seed for reproducible random generation | random |
| `--save-baseline <path>` | save this run's results as a baseline for future diffing | — |
| `--diff-against <path>` | compare this run against a previously saved baseline | — |
| `--ai-edge-cases` | ask Gemini to suggest additional tricky edge-case values, folded into the deterministic generator pool | off |
| `--ai-summarize` | ask Gemini to group and triage unexpected failures into a plain-English summary | off |

Every run prints the seed it used — pass it back with `--seed` to replay the exact same test cases.

### `retrospecs init`

Generates a fuzz config file from an OpenAPI spec or an AI-drafted description. Output is always written to a `.suggested.json` file — review and edit it before renaming it into your real config.

| Flag | Description | Default |
|---|---|---|
| `--from-openapi <specPath>` | path to an OpenAPI JSON or YAML spec — parsed deterministically, no AI, no network | — |
| `--ai` | use Gemini to draft a config from a plain-English description | off |
| `--describe <text>` | description of the endpoint (required with `--ai`) | — |
| `--base-url <url>` | your local server's base URL (**required**) | — |
| `--out <path>` | output config path | `fuzz.config.suggested.json` |

```bash
# from an existing OpenAPI spec
npm run dev -- init --from-openapi ./openapi.yaml --base-url http://localhost:3000

# no spec — describe it in plain English
npm run dev -- init --ai --describe "GET /products takes a search query and a limit 1-100" --base-url http://localhost:3000
```

## Config file

Endpoints, params, auth, and mutation cleanup all live in one JSON file. A minimal example:

```json
{
  "baseUrl": "http://localhost:4000",
  "endpoints": [
    {
      "name": "getUser",
      "method": "GET",
      "path": "/users",
      "params": {
        "id": { "type": "number", "min": 1, "max": 9999 }
      },
      "testCount": 200
    }
  ]
}
```

See [`docs/config-reference.md`](docs/config-reference.md) for the full field-by-field reference, including `auth` (static header or login-flow token), `allowMutations` + `cleanup` for mutating endpoints, and `paramLocation`. More worked examples live in [`examples/configs/`](examples/configs/).

## AI-assisted features

`--ai-edge-cases`, `--ai-summarize`, and `init --ai` all call Gemini Flash and require an API key to be configured. Without one, these flags fail closed — they're skipped rather than crashing the run, and the deterministic core works fully offline with zero API keys either way.

## License

MIT — see [`LICENSE`](LICENSE).