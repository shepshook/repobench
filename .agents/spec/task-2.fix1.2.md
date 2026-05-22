# Task 2.FIX1.2: Wire agentSetupCommands and cachePaths into evaluate/run-all CLI

**Epic:** 2 — Deterministic Sandbox Infrastructure (The Sandbox)  
**Feature:** 2.FIX1 — Global Epic Integration & Alignment Round 1  
**Status:** Pending

---

## Objective
Propagate `agentSetupCommands` and `cachePaths` from `repobench.yaml` into the `SandboxConfig` constructed by the `evaluate` and `run-all` CLI commands. These fields are loaded by `config.ts` but dropped during manual SandboxConfig construction.

## Context
- Feature 2.5 added `agentSetupCommands` to `SandboxConfig` (`contracts.ts:106`) and the sandbox `init()` flow (`sandbox.ts:199-211`).
- Feature 2.4 added `cachePaths` / `cacheVolumes` to `SandboxConfig` (`contracts.ts:103-104`) and the sandbox `init()` flow.
- `repobench.yaml` defines `agent_setup_commands` which is parsed by `loadConfig()` into `RepoBenchConfig.sandbox.agentSetupCommands`.
- **evaluate.ts:62-68** constructs `SandboxConfig` manually and omits `agentSetupCommands` and `cachePaths`.
- **run-all.ts:91-97** constructs `SandboxConfig` manually and omits `agentSetupCommands` and `cachePaths`.
- This is a cross-epic boundary leak: the config exists, the sandbox supports it, but the CLI doesn't pass it through. Downstream epics (Session/Evaluator) cannot use agent setup commands in batch evaluation.

## Instructions

### Step 1 — Fix evaluate.ts sandbox config construction
Edit `src/cli/evaluate.ts`, around line 62-68. Add the missing fields:

```typescript
const sandboxConfig: SandboxConfig = {
  project: opts.project,
  buildCommand: loadedConfig?.sandbox?.buildCommand,
  testCommand: loadedConfig?.sandbox?.testCommand,
  baseImage: loadedConfig?.sandbox?.baseImage,
  envVars: loadedConfig?.sandbox?.envVars,
  agentSetupCommands: loadedConfig?.sandbox?.agentSetupCommands,
  cachePaths: loadedConfig?.sandbox?.cachePaths,
};
```

### Step 2 — Fix run-all.ts sandbox config construction
Edit `src/cli/run-all.ts`, around line 91-97. Add the missing fields:

```typescript
const sandboxConfig: SandboxConfig = {
  project: options.project ?? 'default',
  buildCommand: loadedConfig?.sandbox?.buildCommand,
  testCommand: loadedConfig?.sandbox?.testCommand,
  baseImage: loadedConfig?.sandbox?.baseImage,
  envVars: loadedConfig?.sandbox?.envVars,
  agentSetupCommands: loadedConfig?.sandbox?.agentSetupCommands,
  cachePaths: loadedConfig?.sandbox?.cachePaths,
};
```

### Step 3 — Verify
- Run `npm run typecheck` — must pass (ensure `SandboxConfig` type accepts these fields).
- Run `npm run lint` — must pass.
- Run `npm test` — all tests must pass.

## Acceptance Criteria
1. `evaluate` CLI command reads `agentSetupCommands` and `cachePaths` from `repobench.yaml` and passes them to `Sandbox` constructor.
2. `run-all` CLI command reads `agentSetupCommands` and `cachePaths` from `repobench.yaml` and passes them to `Sandbox` constructor.
3. `Sandbox.init()` receives `agentSetupCommands` when running via `evaluate`/`run-all` CLI (with a valid `repobench.yaml`).
4. Typecheck, lint, and full test suite pass.
