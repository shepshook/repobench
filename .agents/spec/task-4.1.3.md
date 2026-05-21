# Task 4.1.3: Integrate RegressionTestRunner into Evaluator Pipeline

## Goal
Connect the `RegressionTestRunner` into the `Judge` evaluation pipeline.

## Requirements
- Update `Evaluator` (or equivalent service) to use `RegressionTestRunner`.
- Ensure that if `compareResults` detects regressions, the candidate is marked as 'FAILED'.
- Update logs/reporting to clearly state if a regression occurred.

## DoD
- Evaluation pipeline calls the runner.
- Candidates with regressions are correctly invalidated.

## Audit Feedback Round 1
- FAIL: The `RegressionTestRunner` service is implemented but not integrated into any pipeline or service.
- FAIL: The `Evaluator` service described in the requirements is missing from the codebase.
- FAIL: `BenchmarkValidator` (which performs similar validation tasks) has not been updated to use the `RegressionTestRunner`.

## Audit Feedback Round 2
- FAIL: While `BenchmarkValidator` now utilizes `RegressionTestRunner`, the system architecture specifically calls for an `IEvaluator` interface (as per `ARCHITECTURE.md`), which is missing from `src/core/contracts.ts`.
- FAIL: The codebase lacks a service implementing the `IEvaluator` interface. `BenchmarkValidator` appears to be performing evaluation tasks but does not fulfill the architectural requirement for an `Evaluator` service.
- FAIL: The Task 4.1.3 spec requires integration into an "Evaluator Pipeline", but the current implementation integrates it into `BenchmarkValidator` without clarifying if `BenchmarkValidator` is indeed the `Evaluator`.

## Audit Feedback Round 3
- FAIL: The `Evaluator` service is implemented but not integrated into the system orchestrator or pipeline.
- FAIL: Step 3 of the Fix Instructions ("Wire into pipeline") was not completed.
- FAIL: The Task 4.1.3 DoD "Evaluation pipeline calls the runner" is not met as the `Evaluator` is not instantiated or called in any production code path.

## Audit Feedback Round 4
- FAIL: `src/core/services/judge-service.ts` is missing.
- FAIL: `src/cli/evaluate.ts` is missing.
- FAIL: The required evaluation pipeline is not implemented or integrated, failing the refactor plan established in the previous round.

### Root Cause
ARCHITECTURE.md §2 defines the **Judge** module with `IEvaluator` as its key interface (§2, table row "Judge"). The spec requires integration into an "Evaluator Pipeline." However:
1. No `IEvaluator` interface exists in `src/core/contracts.ts` (violates §3.3 "Contract-First Development").
2. No `Evaluator` service class exists anywhere in `src/core/services/`.
3. Previous attempts routed `RegressionTestRunner` through `BenchmarkValidator`, but `BenchmarkValidator` answers "did the fix work?" (pre-fail → post-pass), while the `Evaluator` must answer "did the fix introduce regressions?" (compareResults returning `'regressed'`). These are distinct architectural concerns.

### Fix Instructions (exact order)

**Step 1: Add `IEvaluator` to `src/core/contracts.ts`**
Insert after `EvalMetrics` interface (around line 279):
```ts
export interface IEvaluator {
  evaluate(candidate: Candidate): Promise<EvaluationResult>;
}

export interface EvaluationResult {
  candidateId: string;
  regressionStatus: 'clean' | 'regressed' | 'error';
  comparison: ComparisonResult | null;
  preTestResults: TestResults | null;
  postTestResults: TestResults | null;
  latency: number;
  message: string;
}
```

**Step 2: Create `src/core/services/evaluator.ts`**
Implement `IEvaluator`. The service:
- Takes `ISandbox`, `SandboxConfig`, and `IRegressionTestRunner` (default `new RegressionTestRunner()`) via constructor DI.
- `evaluate(candidate)`: switches sandbox to pre-fix hash, runs tests, switches to post-fix hash, runs tests, calls `runner.compareResults()`. If `comparison.status === 'regressed'`, the candidate is marked as regressed.
- Does NOT replicate `BenchmarkValidator`'s logic (that's for validation, not scoring). The `Evaluator` strictly compares the *full test suite* before vs. after.

**Step 3: Wire into pipeline**
- The `Evaluator` is the service that Task 4.1.3 integrates `RegressionTestRunner` into. Update the orchestrator/E2E flow to call `Evaluator.evaluate(candidate)` after validation.
- `BenchmarkValidator` remains unchanged — it handles candidate validation (Epic 1.5). `Evaluator` handles regression detection (Epic 4.1). They are complementary, not replacements.

**Step 4: Remove `RegressionTestRunner` usage from `BenchmarkValidator` (optional but clean)**
`BenchmarkValidator` at `src/core/services/benchmark-validator.ts:8` instantiates a `RegressionTestRunner` but uses it for validation, not regression detection. Since `compareResults` is now handled by `Evaluator`, `BenchmarkValidator` should revert to using `sandbox.execute()` directly for its pre/post pass/fail check.

### Verification
- `npm run typecheck` must pass.
- `npm run lint` must pass.
- `Evaluator.evaluate()` correctly sets `regressionStatus: 'regressed'` when `compareResults` returns `'regressed'`.
- `BenchmarkValidator` tests continue to pass (no behavioral change to validation flow).

## ESCALATION: REFACTOR

### Root Cause of Deadlock

Task 4.1.3 has passed 3 audit rounds that each added steps incrementally (add `IEvaluator`, create `Evaluator` service), but **Step 3 ("Wire into pipeline")** fails repeatedly because:

1. **No pipeline exists.** `src/cli/` has `mine.ts`, `benchmark.ts`, `index.ts` (export/import only). There is no Judge orchestrator, E2E pipeline, or CLI command that consumes validated candidates and runs them through evaluation.
2. **The spec assumes an orchestrator** but Feature 4.1 is the *first* feature in Epic 4. There is nothing to "wire into" — the pipeline must be *created* as part of this task.
3. **`BenchmarkValidator` still uses `RegressionTestRunner`** (Step 4 not done), creating architectural ambiguity between validation (Epic 1.5) and regression detection (Epic 4.1).

### Refactor Plan

**Replace Step 3 with the following steps:**

**Step 3a: Create a `JudgeService` that IS the evaluation pipeline**
- New file: `src/core/services/judge-service.ts`
- Interface in `contracts.ts`:
  ```ts
  export interface IJudgeService {
    runEvaluationPipeline(sandbox: ISandbox, config: SandboxConfig, candidates: Candidate[]): Promise<EvaluationRunResult[]>;
  }

  export interface EvaluationRunResult {
    candidateId: string;
    result: EvaluationResult;
  }
  ```
- `JudgeService` takes `ISandbox`, `SandboxConfig`, and `IEvaluator` via DI.
- `runEvaluationPipeline()` iterates candidates, calls `evaluator.evaluate()` for each, collects results.
- This is the pipeline that Features 4.2, 4.3, and 4.4 will extend.

**Step 3b: Add a CLI command `repobench evaluate` (or wire into existing flow)**
- New CLI file: `src/cli/evaluate.ts`
- Loads candidates from `CandidateRepository` (only `status: 'validated'` or all pending).
- Creates sandbox, instantiates `Evaluator`, runs `JudgeService.runEvaluationPipeline()`.
- Logs results (which candidates regressed, which are clean).
- Updates candidate status in DB based on regression result.

**Step 4 (mandatory now): Remove `RegressionTestRunner` from `BenchmarkValidator`**
- `BenchmarkValidator` at `src/core/services/benchmark-validator.ts:8-9` uses `RegressionTestRunner` for pre/post pass/fail checks.
- Revert to using `sandbox.execute()` directly. The `RegressionTestRunner` is for regression detection (Evaluator), not validation.
- This eliminates the architectural confusion identified in Audit Round 2.

### Testing Strategy
- `JudgeService` unit test: verify it iterates candidates and delegates to `Evaluator`.
- CLI integration test: verify `repobench evaluate` calls `Evaluator` for at least one candidate.
- Existing `BenchmarkValidator` tests must be updated to use `sandbox.execute()` instead of mocking `RegressionTestRunner.prototype.runTests`. These tests should assert pre-fail → post-pass behavior, NOT comparison results.
- `npm run typecheck && npm run lint` must pass.
