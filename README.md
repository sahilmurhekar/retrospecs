# retrospecs

[![npm version](https://img.shields.io/npm/v/@retrox/retrospecs.svg)](https://www.npmjs.com/package/@retrox/retrospecs)
[![license](https://img.shields.io/npm/l/@retrox/retrospecs.svg)](./LICENSE)

Fuzz-test your localhost API endpoints automatically — no more manually clicking through Postman requests.

## What it does

`retrospecs` reads a version-controlled config file describing your endpoints (base URL + params), auto-generates 100–200 fuzz test cases per endpoint (boundary values, random-valid values, wrong-type values, missing/extreme values), and fires them at your server to check response status codes. Every run is seeded, so failures are exactly reproducible with `--seed`, and you can save a baseline and diff future runs against it to catch regressions.

**Safety guarantee:** requests only ever go to `127.0.0.1` / `::1` / `localhost`. The target hostname is DNS-resolved (not string-matched) before every run, and anything that doesn't resolve to loopback is refused outright. Mutating methods (`POST`/`PUT`/`PATCH`/`DELETE`) are opt-in only — an endpoint must explicitly set `allowMutations: true` and provide a `cleanup` step, or the config fails validation before anything runs.

AI (Gemini Flash) is optional and only ever touches config-authoring and post-run summarization — never the test-execution loop itself. `run --ai-edge-cases`/`--ai-summarize` fail closed with no API key (skipped, never crashing the run). `init --ai` is different: it requires a key to do its job, so it interactively prompts you for one (input masked) if `GEMINI_API_KEY` isn't already set, rather than just failing.

## Install

```bash
npm install -g @retrox/retrospecs
retrospecs run <configPath>
```

or without installing globally:

```bash
npx @retrox/retrospecs run <configPath>
```

To hack on the source itself, clone the repo instead:

```bash
git clone https://github.com/sahilmurhekar/retrospecs.git
cd retrospecs
npm install
npm run dev -- run <configPath>   # equivalent to `tsx src/cli.ts run <configPath>`
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

`--ai-edge-cases`, `--ai-summarize`, and `init --ai` all call Gemini Flash and require an API key to be configured — set `GEMINI_API_KEY` in your environment to skip the prompt below. The deterministic core (`run` without any AI flags) works fully offline with zero API keys, always.

- `run --ai-edge-cases` / `run --ai-summarize`: fail closed with no key. The step is skipped and the rest of the run proceeds normally — a missing key never crashes a fuzz run.
- `init --ai`: requires a key to do its one job (drafting a config), so if `GEMINI_API_KEY` isn't set and you're in an interactive terminal, it prompts you for one on the spot (input masked with `*`) and uses it for that run. Get a free key at https://aistudio.google.com/apikey. In a non-interactive context (CI, a script), there's no one to prompt, so it fails closed with the same clear error instead.

## License

MIT — see [`LICENSE`](LICENSE).