# Task 1.7.2: Create `repobench.yaml` for Target Repository

**Epic:** 1 — Git-Based Benchmark Generation (The Miner)
**Feature:** 1.7 — CLI Integration & Config Readiness
**Status:** Not Started

---

## Objective
Create the `repobench.yaml` configuration file that tells RepoBench how to mine, build, and test the target repository.

## Context
- `src/core/config.ts` defines the `RepoBenchConfigSchema` with `mining`, `curation`, and `sandbox` sections.
- `src/core/services/miner.ts` reads the config to determine keywords, exclude paths, etc.
- The sandbox reads `build_command` and `test_command` from the config to set up the container.
- Currently no `repobench.yaml` exists — the miner uses defaults and the sandbox falls back to no build/test commands.

## Instructions

### Step 1 — Create `repobench.yaml` for the RepoBench repository itself
Create a `repobench.yaml` file in the project root:

```yaml
mining:
  keywords:
    - fix
    - bug
    - error
    - issue
    - patch
  exclude_paths:
    - node_modules/
    - .git/
    - dist/
  since: "2025-01-01T00:00:00Z"

sandbox:
  build_command: "npm ci"
  test_command: "npm test"
  base_image: "node:20-alpine"
```

### Step 2 — Verify config loads
- Run `node -e "const { loadConfig } = require('./dist/core/config.js'); loadConfig().then(c => console.log(JSON.stringify(c, null, 2))).catch(e => console.error(e))"` (or use TypeScript equivalent).
- The config should parse without errors.

### Step 3 — Store RepoBench's own config for dogfooding
The `repobench.yaml` will be used to mine candidates from this repository and evaluate agents against them. This is dogfooding — RepoBench benchmarks itself.

## Acceptance Criteria
1. `repobench.yaml` exists in the project root with valid YAML.
2. `loadConfig()` successfully parses it.
3. Mining keywords include at least `fix`, `bug`, `error`, `issue`, `patch`.
4. `node_modules/`, `.git/`, `dist/` are excluded.
5. Build command is `npm ci`.
6. Test command is `npm test`.
7. Base image is `node:20-alpine`.
