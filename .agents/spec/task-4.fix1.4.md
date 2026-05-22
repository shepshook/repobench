# Task 4.FIX1.4: Audit Cross-Module Boundary Leaks & Final Integration Verification

## Priority: HIGH

## Problem
This is the final gate task. After Tasks 4.FIX1.1–4.FIX1.3 are complete, this task verifies that no residual boundary leaks remain and the full integration pipeline works end-to-end.

## Cross-Module Boundaries to Verify

### Boundary A: Epic 1 (Miner) → Epic 4 (Judge)
- Candidate data flows from `CandidateRepository.getAll()` → filtered by `status === 'validated'` → `JudgeService.runEvaluationPipeline()`
- **Check**: Candidates with `preFixHash`/`postFixHash` properly flow into the evaluator

### Boundary B: Epic 2 (Sandbox) → Epic 4 (Judge)
- `ISandbox.switchState(hash)` used by Evaluator to switch between pre/post fix commits
- `ISandbox.execute(command)` used by RegressionTestRunner to run test commands
- `ISandbox.getFileAccessTracker()` used by Evaluator to feed EfficiencyTracker
- **Check**: File access tracking data from Sandbox correctly populates EfficiencyMetrics in EvaluationResult

### Boundary C: Epic 3 (Session) → Epic 4 (Judge)
- `SessionOrchestrator.executeSession()` produces `{ success, cost }` → should flow into `Evaluator.evaluate(candidate, cost)`
- `CostParser` extracts token cost → should reach E-Score denominator
- **Check**: Real cost data (not default `1`) reaches the E-Score formula (fixed in Task 4.FIX1.1)

### Boundary D: Epic 4 (Judge) → Epic 5 (Leaderboard)
- `EvaluationRunResult[]` produced by JudgeService must be compatible with the Leaderboard's `RunResultSchema`
- **Check**: `EvaluationRunResult` has all fields needed by Epic 5 persistence layer

## End-to-End Integration Test

1. Create a test that simulates the full pipeline:
   - Mine a repo → validate candidates → persist to DB → run `repobench evaluate` → verify output contains E-Scores and regression statuses
2. Verify the CLI `repobench evaluate` command produces:
   - Per-candidate output with `regressionStatus` and `message`
   - No crashes when candidates have missing `preFixHash`/`postFixHash`
   - Proper error messages when sandbox operations fail

## Verification Commands
```bash
npm run typecheck
npm run lint
npm test
```

## DoD
- [ ] All 4 cross-module boundaries verified (no data silently dropped)
- [ ] Full `repobench evaluate` pipeline runs without errors on mock data
- [ ] Cost data flows from Session → Evaluator (verified via test assertion)
- [ ] E-Score output includes real efficiency metrics from file access tracker
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` ≤ 150 errors
- [ ] `npm test` has 0 test suite failures from persistence-layer or PTY causes (remaining failures must be documented as known platform-specific issues)
- [ ] Epic 4 closure checklist items all marked [x] in ROADMAP.md

## Audit Feedback Round 1
- **Status**: FAIL
- **Feedback**: The integration tests (`tests/integration/boundary-audit.test.ts` and `tests/integration/full-pipeline.test.ts`) pass and verify the required cross-module boundary data flows. However, the existing test suite has a failure in `tests/core/search-efficiency-tracker-coverage.test.ts` (`should calculate efficiency ratio correctly when accessed is more than modified`). This test failure must be resolved or documented as a known issue in the spec as per the DoD.

