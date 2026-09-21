# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-22

First public launch — the project is now live on GitHub with CI in place.

### Changed
- Moved `typescript` from `dependencies` to `devDependencies` — it's only needed to build the project (`tsc`), never required at runtime, so every install is now one less (large) package.
- Added `repository`, `homepage`, and `bugs` fields to `package.json`, and an npm version + license badge to the README, now that the project is public on GitHub.
- Reworked the npm publish GitHub Actions workflow to use npm Trusted Publishing (OIDC) instead of a stored `NPM_TOKEN` secret, removing the need to manage an expiring token.

## [0.2.0] - 2026-09-21

### Changed
- `init --ai` now interactively prompts for `GEMINI_API_KEY` (input masked) when it isn't already set in the environment, instead of just failing — only in an interactive terminal; falls back to the original fail-closed error in non-interactive contexts (CI, scripts). `run --ai-edge-cases`/`--ai-summarize` are unaffected and still fail closed silently.

## [0.1.0] - 2026-09-21

Initial public release, published to npm as `@retrox/retrospecs`.

### Added
- Core fuzzing engine: localhost-only guard (DNS-resolved, refuses anything non-loopback), seeded PRNG for reproducible runs
- Generators for string / number / boolean params (boundary, random-valid, wrong-type, missing, extreme cases)
- Status-code validation with pass/fail classification by expected outcome (success vs. rejection)
- Concurrency-limited executor with per-request timeout and a circuit breaker after consecutive failures
- Config file format (Zod-validated) covering endpoints, params, auth, cleanup, and mutation opt-in
- `retrospecs run <configPath>` CLI command with `--concurrency`, `--seed`, `--save-baseline`, `--diff-against`
- Baseline/diff regression detection (`--save-baseline`, `--diff-against`)
- Auth support: static header/value, or a login step that resolves a Bearer token once before the run
- Opt-in mutation testing (`allowMutations: true`) with a required `cleanup` step to avoid leaving fuzz data behind
- `retrospecs init` CLI command: `--from-openapi` for deterministic config generation from an OpenAPI spec, `--ai --describe` for Gemini-drafted configs
- AI-assist package: `--ai-edge-cases` (Gemini-suggested edge values folded into the generator pool) and `--ai-summarize` (post-run failure triage), both fail-closed with no API key and cached by content hash
- JSON reporter: `results.json` (every case) and `summary.json` (pass/fail counts, `byOutcome` breakdown, `unexpectedFailures`)
- HTML reporter (`--html-report` flag): a self-contained `report.html` per endpoint as a visual alternative to the JSON output
- README, config file reference doc, and MIT license
