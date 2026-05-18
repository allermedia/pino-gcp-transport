# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow

TDD is mandatory. Add or update a test in `test/<feature>-test.js` and confirm it fails for the right reason before changing anything in `src/`. The test infrastructure (mocha, chai `expect` global, chronokinesis for frozen time, nock, supertest, fastify `app.inject()`) is set up so new behavior gets specified by tests first — use it.

## Commands

- `npm test` — runs `build` (pretest) → `mocha` → `lint` and `example` (posttest). Mocha config in `.mocharc.json` recurses through `test/` and auto-loads `chai/register-expect.js` so `expect` is a global in tests.
- `npm run build` — `rollup -c` (builds CJS to `lib/`) and `dts-buddy` (generates `types/`). Required before tests because `test/pkg-test.js` stat-checks `package.json` `main`/`module`/`types`/`exports` paths, and tests import the package by its published name `@aller/pino-gcp-transport` (resolved via the local `package.json` `exports`).
- `npm run lint` — ESLint (with `--cache`) + Prettier `--check`.
- `npm run example` — `texample -g` runs the JS code blocks embedded in README files (root and `example/**/README.md`) as live examples; lint failures here mean a README snippet is broken.
- Run a single test: `npx mocha test/<file>-test.js` or `npx mocha --grep "<pattern>"`. Skip the build step at your own risk — `pkg-test.js` will fail without `lib/` present.
- `npm run cov:html` / `npm run test:lcov` — coverage via c8.

## Architecture

This is a dual-published (ESM + CJS) Pino transport that converts Pino log lines into Google Cloud structured JSON, plus a W3C trace-context tracker that piggybacks on the same logging pipeline.

**Two cooperating subsystems, both in `src/`:**

1. **Transport (`src/index.js`)** — `compose()` returns a `pino-abstract-transport` that pipes: pino source → `StructuredTransformation` (object-mode `Transform`) → JSON-stringify Transform → `SonicBoom` destination (or a caller-supplied writable). `StructuredTransformation.convertToStructured` is the core mapping: pino `level` → GCP `severity`, `time` → `{seconds, nanos}` timestamp object (per GCP docs, not ISO string), `req` → `httpRequest`, serialized `err` → `textPayload` + `logging.googleapis.com/sourceLocation` parsed from the stack via `STACK_PATTERN` in `constants.js`. The `ignoreKeys` option filters which top-level pino keys flow into `jsonPayload`. To customize, pass a subclass of `StructuredTransformation` as `compose`'s second argument.

2. **Tracing (`src/tracing.js`)** — module-level `AsyncLocalStorage` holds `{traceId, spanId, flags}` for the current request. `middleware()` (Express) and `fastifyHook()` extract `traceparent` or `x-cloud-trace-context` from incoming headers (or generate fresh IDs) and call `storeTracing` to enter the ALS scope. `getLogTrace(projectId)` is intended for pino's `mixin` — it reads from the ALS and emits `logging.googleapis.com/trace` (formatted as `projects/<id>/traces/<traceId>`), `spanId`, and `trace_sampled`. `getTraceHeaders` / `getTraceHeadersAsObject` produce headers to forward to downstream calls. `SpanContext` lets you run a function inside a new or inherited span context outside the request lifecycle (e.g., scheduled jobs).

The two subsystems are decoupled: the transport works without tracing, and tracing works without the transport (it just emits the GCP-formatted keys via mixin). They meet only through the well-known `logging.googleapis.com/*` keys defined in `src/constants.js`.

## Build and packaging

- `package.json` `type: module`; sources are ESM in `src/`. Rollup emits CJS to `lib/index.cjs` and `lib/tracing.cjs`. `dts-buddy` produces bundled `.d.ts` files in `types/`. The `lib/` directory is gitignored but published (declared in `package.json` `files`).
- `package.json` `exports` has two subpaths: `.` (full API including transport) and `./tracing` (tracing-only, no Pino/SonicBoom dependency). The CJS footer in `rollup.config.js` reassigns `module.exports = Object.assign(exports.default, exports)` so `require('@aller/pino-gcp-transport')` returns the `compose` function with named exports attached.
- `peerDependencies`: `pino-abstract-transport` and `sonic-boom`. Pino itself is a dev dep — consumers bring their own.
- Node `>=18` is required (uses `node:async_hooks` AsyncLocalStorage and modern stream `pipeline`).

## Testing notes

- Tests import via `@aller/pino-gcp-transport` (the package name), not relative paths — this exercises the actual `exports` map.
- `chronokinesis` (`ck.freeze()` / `ck.reset()`) is used to stabilize timestamps in compose tests.
- `nock` mocks HTTP for downstream-call tests; `supertest` drives Express, `app.inject()` drives Fastify.
- `test/stdout-test.js` tests behavior when piping to real stdout — be aware it spawns subprocesses.
