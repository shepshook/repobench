# Task 5.2.3: Implement BatchRunner Orchestration Logic

## Context
- Module: `src/core/services/batch-runner.ts`
- Requirement: Feature 5.2 (Multi-Agent Batch Runner)
- Goal: Implement `BatchRunnerService` that orchestrates multi-agent batch execution by iterating over candidates, spawning per-agent workers, and collecting results.

## Technical Directive
1. Create `src/core/services/batch-runner.ts` implementing `IBatchRunner`:
   - Constructor accepts:
     - `workerPool: IWorkerPool`
     - `sessionOrchestratorFactory: (agentId: string) => ISessionOrchestrator`
     - `judgeServiceFactory: (agentId: string) => IJudgeService`
     - `sandboxFactory: () => ISandbox`
     - `candidateRepository: CandidateRepository`
     - `config: BatchConfig`
   - `runAll(config: BatchConfig): Promise<BatchRunSummary>`:
     1. Resolve candidate list: if `config.candidateIds` is provided, fetch those; otherwise fetch all validated candidates from `CandidateRepository`.
     2. Build a list of `(candidateId, agentId)` pairs for every combination of candidate × agent (Cartesian product).
     3. Submit each pair as a `WorkerTask` to `this.workerPool.exec()`.
     4. Each worker task:
        a. Create sandbox via `sandboxFactory()`, init, run `SessionOrchestrator.executeSession()`.
        b. Pass session results (cost data) into `JudgeService.runEvaluationPipeline()` for the single candidate.
        c. Collect `EvaluationRunResult` and persist via `IRunResultRepository` (already wired inside `JudgeService`).
        d. Return aggregated per-pair result.
     5. On completion, aggregate all `WorkerResult[]` into `BatchRunSummary`.
   - Error wrapping: each worker task must catch errors from `Sandbox`, `SessionOrchestrator`, or `JudgeService`, wrap them in a structured `BatchRunError` (containing `agentId`, `candidateId`, original error message, and any captured `stdout`/`stderr`), and propagate as a rejected `WorkerResult`.
   - `cancel()`: delegates to `this.workerPool.shutdown()`.
   - **Persistence clarification**: per-run results are persisted inside `JudgeService.runEvaluationPipeline()` via `IRunResultRepository` (wired in Feature 5.1). `BatchRunnerService` does NOT perform direct SQL queries.
2. Create `src/core/services/batch-runner.test.ts`:
   - Mock `IWorkerPool`, `ISessionOrchestrator`, `IJudgeService`, `ISandbox`, `CandidateRepository`.
   - Verify Cartesian product: 2 agents × 3 candidates → 6 worker tasks.
   - Verify partial failure: if one pair fails, the batch continues and aggregates errors.
   - Verify `cancel()` triggers `workerPool.shutdown()`.

## DoD
- `BatchRunnerService` produces the full Cartesian product of agents × candidates.
- Individual pair failures are isolated; remaining pairs still execute.
- `BatchRunSummary` correctly aggregates successful/failed runs and per-agent metrics.
- All unit tests pass (`npx vitest run tests/core/services/batch-runner.test.ts`).

- `npm run typecheck && npm run lint` pass.

## Audit Feedback Round 1
- **Status**: FAIL
- **Reason**: The required files `src/core/services/batch-runner.ts` and `src/core/services/batch-runner.test.ts` were not found in the codebase. The implementation of `BatchRunnerService` as required by the specification is missing.

## Audit Feedback Round 2
- **Status**: FAIL
- **Reason**: `src/core/services/batch-runner.ts` is implemented, but the mandatory test file `src/core/services/batch-runner.test.ts` is missing, violating the Definition of Done (DoD) requiring unit tests to pass.

## ESCALATION DIRECTIVE
**Diagnosis**: Both `src/core/services/batch-runner.ts` and `tests/core/services/batch-runner.test.ts` now exist. The test file was likely created after Round 2 but never re-audited.

**Validation results** (all pass):
- `npx vitest run tests/core/services/batch-runner.test.ts` → **8 tests pass**
- `npm run typecheck` → **no errors**
- `npm run lint` → **no errors**

**What was needed**: The missing test file `tests/core/services/batch-runner.test.ts` (220 lines, 8 test cases covering Cartesian product, candidate resolution, partial failure isolation, `cancel()`, full pipeline execution, summary aggregation, and error wrapping). It now exists and passes all validations.

**Action**: Mark this task as complete in ROADMAP.md and proceed to Task 5.2.4. No code changes required.
