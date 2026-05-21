# Task 4.FIX1.1: Wire SessionOrchestrator Cost Data into Evaluator Pipeline

## Priority: HIGH

## Problem
`SessionOrchestrator.executeSession()` (`src/core/services/session-orchestrator.ts:52-78`) captures `{ success, cost }` from `CostParser` and `validateAndRollback()` but never passes this data to the `Evaluator.evaluate()` method. The `Evaluator.evaluate(candidate, cost?)` overload accepts an optional `cost` parameter (line 29-30 of `src/core/services/evaluator.ts`), but in the `repobench evaluate` CLI path (`src/cli/evaluate.ts:30`), the Evaluator is called without cost, defaulting to `1` in the E-Score denominator. This means the E-Score formula always uses `cost=1` instead of the real token-based cost extracted during a session run.

## Root Cause
The `JudgeService.runEvaluationPipeline()` calls `evaluator.evaluate(candidate)` without a `cost` argument. The SessionOrchestrator's `{ success, cost }` result is never wired into the evaluation pipeline. The `repobench evaluate` CLI creates an Evaluator directly, not through SessionOrchestrator, and has no mechanism to supply real cost data.

## Task
1. Update `IJudgeService.runEvaluationPipeline()` in `src/core/contracts.ts` to accept an optional `costMap?: Map<string, number>` (candidateId → cost) parameter.
2. Update `JudgeService.runEvaluationPipeline()` in `src/core/services/judge-service.ts` to pass cost to `evaluator.evaluate()` for each candidate.
3. Update `src/cli/evaluate.ts` to accept an optional `--cost` flag or `--cost-file` for loading per-candidate cost data (default `1` for each candidate with a warning logged).
4. Add a `cost` field to `EvaluationRunResult` in contracts.ts.
5. Update `judge-service.test.ts` to verify cost is passed through.
6. Update `evaluator.test.ts` to add an explicit test for cost propagation through the pipeline.
7. Run `npm run typecheck && npm test -- tests/core/services/` to verify.

## Files to Modify
- `src/core/contracts.ts` — Add `cost` to `EvaluationRunResult`; update `IJudgeService` signature
- `src/core/services/judge-service.ts` — Wire cost into evaluate() calls
- `src/cli/evaluate.ts` — Accept optional cost input
- `tests/core/services/judge-service.test.ts` — Assert cost propagation
- `tests/core/services/evaluator.test.ts` — Add cost propagation test

## DoD
- [ ] `JudgeService` passes per-candidate cost to `Evaluator.evaluate()`
- [ ] CLI `repobench evaluate` logs a warning when running without cost data
- [ ] E-Score calculation receives real cost when available (not default `1`)
- [ ] All existing tests pass; new cost-propagation tests added
