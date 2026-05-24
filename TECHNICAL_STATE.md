# RepoBench Technical State

**Date:** 2026-05-23
**Branch:** master
**Tasks:** 224/230 complete (97%)

---

## 1. Architecture Overview

### Layered Design

```
CLI (commander)  →  Core Services  →  Infrastructure
   mine.ts               miner.ts          sandbox.ts
   evaluate.ts           evaluator.ts      pty-session.ts
   run-all.ts            judge-service.ts  database.ts
   report.ts             curation-svc.ts   volume-manager.ts
   export-failures.ts    batch-runner.ts   failure-artifact-exporter.ts
                         adapter-factory.ts
```

### Key Interfaces (contracts.ts)

| Interface | Purpose |
|-----------|---------|
| `IMiner` | Discover bug-fix candidates from git history |
| `ISandbox` | Docker container lifecycle + command execution |
| `IPtySession` | Interactive PTY session for agent communication |
| `ICandidateRepository` | CRUD for mined candidates |
| `IRunResultRepository` | Persistence for evaluation runs |
| `IEvaluator` | Run tests, compare pre/post results |
| `IJudgeService` | Orchestrate full evaluation pipeline |
| `IFailureArtifactExporter` | Export diff/artifacts for failed runs |

---

## 2. Features

### Epic 1: Git-Based Benchmark Generation (Miner)
**Status:** ✅ Complete (46/46 tasks)

| File | Role |
|------|------|
| `src/core/services/miner.ts` | `GitMiner` — extracts commits, applies keyword + path + significance filters |
| `src/core/services/filters/significance-filter.ts` | `BasicSignificanceFilter` — rejects whitespace/comment-only changes |
| `src/core/services/curation-service.ts` | `NoOpCurationService` (default) / `OpenAICurationService` for LLM-based scoring |
| `src/core/repositories/candidate-repository.ts` | Persistence via `better-sqlite3` with upsert support |

**Config** (`repobench.yaml`): `mining.keywords`, `mining.exclude_paths`, `mining.since` (overridden to undefined in CLI to avoid simple-git revision-range bug).

**Known limitation:** `simple-git`'s `LogOptions.from` maps to a git revision range, not `--since`. Raw git is needed for date-based filtering.

### Epic 2: Deterministic Sandbox Infrastructure
**Status:** ✅ Complete (31/31 tasks)

| File | Role |
|------|------|
| `src/infrastructure/sandbox.ts` | `Sandbox` — Docker container lifecycle, simulation mode, workspace bind-mount, git state switching |
| `src/infrastructure/volume-manager.ts` | Docker volume caching for `node_modules` across containers |
| `src/infrastructure/failure-artifact-exporter.ts` | Exports `diff.patch`, `session.log`, `ground-truth.diff` for failed runs |

**Architecture decisions (ADR-001):**
- `FORCE_SIMULATION=true` required for simulation mode (no silent fallback)
- `workspaceDir` getter returns `/app` (container-invariant mount point)
- Container paths use POSIX format; host paths use platform-native `resolve()`

### Epic 3: Interactive Agent Session Orchestration
**Status:** 🟡 Complete (49/49 tasks, 1 success criteria pending)

| File | Role |
|------|------|
| `src/infrastructure/pty-session.ts` | `PtySession` — worker-thread-backed interactive PTY with IPC timeout handling |
| `src/core/services/session-orchestrator.ts` | Manages session lifecycle, prompt injection, completion detection |
| `src/core/services/prompt-handler.ts` | Handles prompt/response exchange |
| `src/infrastructure/agents/` | Adapter implementations: `ClaudeCodeAdapter`, `AiderAdapter`, `OpencodeAdapter` |

**Pending:** Epic 3 success criteria — "Reliable wrapper, auto-approve scripts, and 'Done' signal detection."

**Key features:**
- Worker-thread isolation for PTY sessions with `postMessage` IPC
- Auto-approve configs via regex patterns (e.g., `[y/n]` prompts)
- `SimulationFixtures` for test-injectable mock handlers

### Epic 4: Evaluation & Scoring Engine (Judge)
**Status:** ✅ Complete (23/23 tasks)

| File | Role |
|------|------|
| `src/core/services/evaluator.ts` | Runs test suites, compares pre-fix vs post-fix results |
| `src/core/services/judge-service.ts` | Orchestrates evaluation pipeline (switchState → runTests → compare → record) |
| `src/core/services/benchmark-validator.ts` | Validates candidates via sandbox (pre-fail, post-pass) |

### Epic 5: Comparative Analysis & Reporting (Leaderboard)
**Status:** 🟡 Feature-level checked, epic-level pending (31/31 tasks)

| File | Role |
|------|------|
| `src/cli/report.ts` | Reads `run_result_repo`, renders leaderboard table |
| `src/cli/export-failures.ts` | Exports failure artifacts for all failed runs |
| `src/core/services/batch-runner.ts` | Parallel candidate processing with worker pool |
| `src/core/services/batch-progress-reporter.ts` | Real-time console progress during batch runs |

---

## 3. Config Layer

### Schema (`src/core/config.ts`)
- Zod-based parsing with transform layer (`build_command` → `buildCommand`)
- Supports `mining`, `sandbox`, and `curation` blocks
- `sandbox.workspace_path` → `workspacePath` for Docker bind mount source

### Current `repobench.yaml`
```yaml
mining:
  keywords: [fix, bug, error, issue, patch]
  exclude_paths: [node_modules/, .git/, dist/]

sandbox:
  build_command: "apk add --no-cache python3 make g++ git && cd /app && npm install"
  test_command: "npm test"
  base_image: "node:20-alpine"
  workspace_path: "."
  cache_paths: [/app/node_modules]
  agent_setup_commands: [echo "Skipping opencode installation for dogfooding"]
```

---

## 4. Anti-Patterns Eliminated

| Anti-pattern | Fix | Enforced By |
|---|---|---|
| Silent Docker fallback | `FORCE_SIMULATION=true` required | `sandbox.ts:138` |
| 200-line if/else command simulation | `SimulationFixtures` delegate + real subprocess | `sandbox.ts:530` |
| Import side-effect registrations | `registerAllAdapters()` in dedicated module | `cli/index.ts:71` |
| `baseImagePath` dual-key fallback | Removed from interface and all references | ESLint, contracts.ts |
| `__dirname` in ESM | ESLint `no-restricted-globals` | `eslint.config.js` |
| Empty catch blocks | ESLint `no-empty` with `allowEmptyCatch: false` | `eslint.config.js` |
| `repobench.db` tracked by git | `git rm --cached` + `.gitignore` | `.gitignore` |
| Hardcoded `/app` paths | `workspaceDir` getter returning `/app` | `sandbox.ts:86` |

---

## 5. Pipeline Commands

| Command | Status | Notes |
|---|---|---|
| `mine -r .` | ✅ Works | 7 candidates found from RepoBench repo |
| `evaluate --project repobench` | ✅ Completes | 7/7 candidates processed; DB lock on bind-mount causes per-candidate errors (known env limitation) |
| `run-all -a opencode --concurrency 1` | ⚠️ Pending agent install | Agent setup commands disabled for dogfooding |
| `report` | ✅ Works | Leaderboard or "No data available" |
| `export-failures` | ✅ Works | Creates `exports/` with patch, log, and diff |

---

## 6. Quality Gates

| Gate | Status |
|------|--------|
| `npm run typecheck` | ✅ Passes (0 errors) |
| `npm run lint` | ✅ Passes (0 errors) |

### ESLint Custom Rules

| Rule | Target |
|-------|--------|
| `no-empty` with `allowEmptyCatch: false` | Empty catch blocks |
| `no-restricted-globals` (`__dirname`) | ESM `__dirname` usage |
| `no-restricted-properties` (`process.exit`) | `process.exit()` in non-CLI code |

---

## 7. Known Limitations

1. **DB lock on bind-mount:** `repobench.db` tracked file + host process lock prevents `git reset --hard` in container. Fixed by removing from git tracking; requires clean checkout for first evaluation run.
2. **simple-git `--since` bug:** `LogOptions.from` maps to revision range, not `--since`. CLI overrides to `undefined` (mines all history).
3. **Windows bind-mount instability:** Docker Desktop on Windows may intermittently miss files in mounted directories.
4. **Agent setup commands disabled:** `opencode` not installed in sandbox for dogfooding; requires npm package or custom image.

---

## 8. Commit History Pattern

The repo follows conventional commits:
- `feat:` — New feature/task completion
- `fix:` — Bug fix
- `chore:` — Release, cleanup, non-functional changes
