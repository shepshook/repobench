# Task 1.7.FIX2: Wire repobench.yaml Sandbox Config into evaluate/run-all CLI

**Epic:** 1 — Git-Based Benchmark Generation (The Miner)
**Feature:** 1.7 — CLI Integration & Config Readiness
**Status:** Not Started

---

## Objective
Fix `evaluate.ts` and `run-all.ts` to load sandbox configuration (`build_command`, `test_command`, `base_image`) from `repobench.yaml` instead of constructing a bare `SandboxConfig` with only `project`.

## Context
- `src/cli/evaluate.ts:54` constructs `sandboxConfig = { project: opts.project }` — missing `buildCommand`, `testCommand`, `baseImage`, `envVars`.
- `src/cli/run-all.ts:83` does the same: `sandboxConfig = { project: options.project }`.
- `src/core/config.ts` defines `loadConfig()` which parses `repobench.yaml` and yields a `RepoBenchConfig` with a `sandbox` section containing `buildCommand`, `testCommand`, `baseImage`.
- The `Sandbox` class (`src/infrastructure/sandbox.ts`) and `Evaluator` (`src/core/services/evaluator.ts`) both read from `SandboxConfig`, but those values are never populated.
- Meanwhile, `src/cli/mine.ts` already calls `loadConfig()` correctly.

## Instructions

### Step 1 — Update `evaluate.ts`
In `src/cli/evaluate.ts`:

1. Add import for `loadConfig`:
```typescript
import { loadConfig } from '../core/config.js';
```

2. After `initDatabase()` and before `const sandboxConfig: SandboxConfig = ...`, load the config and populate sandbox properties:
```typescript
let loadedConfig: RepoBenchConfig | undefined;
try {
  loadedConfig = await loadConfig('repobench.yaml');
} catch {
  console.warn('Warning: Could not load repobench.yaml, using defaults for sandbox config');
}

const sandboxConfig: SandboxConfig = {
  project: opts.project,
  buildCommand: loadedConfig?.sandbox?.buildCommand,
  testCommand: loadedConfig?.sandbox?.testCommand,
  baseImage: loadedConfig?.sandbox?.baseImage,
  envVars: loadedConfig?.sandbox?.envVars,
};
```

You'll need to import the `RepoBenchConfig` type:
```typescript
import { RepoBenchConfig } from '../core/config.js';
```

### Step 2 — Update `run-all.ts`
In `src/cli/run-all.ts`:

1. Add imports:
```typescript
import { loadConfig, RepoBenchConfig } from '../core/config';
```

2. After `initDatabase()` and before `const sandboxConfig: SandboxConfig = ...`, load the config:
```typescript
let loadedConfig: RepoBenchConfig | undefined;
try {
  loadedConfig = await loadConfig('repobench.yaml');
} catch {
  console.warn('Warning: Could not load repobench.yaml, using defaults for sandbox config');
}

const sandboxConfig: SandboxConfig = {
  project: options.project ?? 'default',
  buildCommand: loadedConfig?.sandbox?.buildCommand,
  testCommand: loadedConfig?.sandbox?.testCommand,
  baseImage: loadedConfig?.sandbox?.baseImage,
  envVars: loadedConfig?.sandbox?.envVars,
};
```

### Step 3 — Verify
- Run `npm run typecheck` — must pass.
- Run `npm run lint` — must pass.
- Run `npm test` — all tests must pass.

## Acceptance Criteria
1. `evaluate.ts` constructs `SandboxConfig` with `buildCommand`, `testCommand`, `baseImage` from `repobench.yaml`.
2. `run-all.ts` constructs `SandboxConfig` with `buildCommand`, `testCommand`, `baseImage` from `repobench.yaml`.
3. If `repobench.yaml` is missing or malformed, the CLI warns and falls back to defaults (no crash).
4. Typecheck, lint, and full test suite pass.
