# Task 5.1.4: Integration into Evaluation Pipeline

## Context
- Module: `src/core/services/judge-service.ts`
- Requirement: Feature 5.1 (Results Persistence Layer)
- Goal: Wire `IRunResultRepository` into the evaluation pipeline so results persist automatically.

## Technical Directive
1. Update `IJudgeService` interface in `src/core/contracts.ts`:
   - Add `agentId: string` parameter to `runEvaluationPipeline`.
   - Add optional `logPath?: string` parameter to `runEvaluationPipeline`.
2. Update `JudgeService` constructor to accept `IRunResultRepository`.
3. In `runEvaluationPipeline`, after each `evaluator.evaluate()` call completes:
   - Construct a `RunResult` object (generate `runId` via uuid, `timestamp` via `new Date()`).
   - Derive `success` from `EvaluationResult.regressionStatus === 'clean'`.
   - Call this.repository.save(runResult).
4. Error isolation: wrap the save call in try/catch — log the error but do not block the pipeline.
5. Update all callers of `IJudgeService.runEvaluationPipeline` to pass `agentId` and optionally `logPath`. This includes:
   - CLI commands in `src/cli/`
   - Any integration orchestrators that invoke the judge.
   - Test files that construct or mock `JudgeService`.

## DoD
- `IJudgeService.runEvaluationPipeline` accepts `agentId` and optional `logPath`.
- 100% of evaluation runs persist to the `runs` table.
- A failed `repository.save()` does not crash the pipeline.
- Integration tests verify that persisted data matches in-memory results.
