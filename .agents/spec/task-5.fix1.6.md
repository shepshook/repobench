# Task 5.FIX1.6: Global Regression Verification — Run-All CLI, Judge Persistence & Boundary Audit

**Epic:** 5 — Comparative Analysis & Reporting
**Feature:** 5.FIX1 — Global Epic Integration & Alignment Round 1
**Assigned to:** Agent
**Status:** Not Started

---

## Objective
Run the full Epic 5 integration test suite to verify no regressions were introduced by tasks 5.FIX1.1 through 5.FIX1.5. Fix any test failures that result from contract/signature changes.

## Context
- Tasks 5.FIX1.1–5.FIX1.5 make targeted structural changes to contracts, services, repositories, and CLI wiring.
- Integration tests may need minor updates to match new signatures (e.g., `judgeServiceFactory` now takes `ISandbox` instead of `string`).
- The goal of this task is to run the full suite and fix any test breakage caused by the alignment changes.

## Instructions

### Step 1 — Run the full Epic 5 test suite
```bash
npx vitest run tests/core/services/batch-runner.test.ts tests/core/services/batch-runner-di.test.ts tests/core/services/leaderboard-reporter.test.ts tests/core/services/judge-service.test.ts tests/core/repositories/run-result-repository.test.ts tests/core/leaderboard-contracts.test.ts tests/core/batch-contracts.test.ts tests/integration/run-all-cli.test.ts tests/integration/report-cli.test.ts tests/integration/export-failures-cli.test.ts tests/integration/judge-persistence.test.ts tests/integration/full-pipeline.test.ts tests/integration/boundary-audit.test.ts tests/infrastructure/failure-artifact-exporter.test.ts
```

### Step 2 — Fix any test failures

#### Expected failure: `batch-runner.test.ts`
The `BatchRunnerService` constructor signature changed (`judgeServiceFactory` now takes `ISandbox` instead of `string`). Update the test's mock factory:
- Change any `judgeServiceFactory` mock from `(_agentId: string) =>` to `(_sandbox) =>` (it was already ignoring the parameter, so just update the type signature).
- The factory mock returned by `mockJudgeServiceFactory` should accept `ISandbox` instead of `string`.

#### Expected failure: `run-all-cli.test.ts`
- Mock import path on line 18 (`../../services/session-orchestrator` → `../../core/services/session-orchestrator`) may need fixing if it causes resolution issues.

#### Expected failure: `batch-runner-di.test.ts`
- If the test constructs `BatchRunnerService` with a typed `judgeServiceFactory`, update the parameter type from `(_agentId: string)` to `(_sandbox)`.

### Step 3 — Run the broader regression suite
After fixing Epic 5 tests, run a broader sweep to ensure no cross-module breakage:
```bash
npx vitest run tests/core/contracts.test.ts tests/core/services/evaluator.test.ts tests/core/services/e-score-service.test.ts tests/integration/evaluate-cli.test.ts
```

### Step 4 — Final verification
- Run `npm run typecheck` — must pass with zero errors.
- Run `npm run lint` — must pass with zero errors.
- Re-run the full Epic 5 test suite — all tests must pass.

## Acceptance Criteria
1. All Epic 5 integration tests pass: `run-all-cli`, `report-cli`, `export-failures-cli`, `judge-persistence`, `full-pipeline`, `boundary-audit`.
2. All Epic 5 unit tests pass: `batch-runner`, `batch-runner-di`, `leaderboard-reporter`, `judge-service`, `run-result-repository`, `leaderboard-contracts`, `batch-contracts`, `failure-artifact-exporter`.
3. No regression in broader suite (`contracts`, `evaluator`, `e-score-service`, `evaluate-cli`).
4. TypeScript typechecks cleanly, lint passes.
