# Task 5.FIX1.2: Bubble Swallowed Errors in JudgeService — DB Save & Artifact Export

**Epic:** 5 — Comparative Analysis & Reporting
**Feature:** 5.FIX1 — Global Epic Integration & Alignment Round 1
**Assigned to:** Agent
**Status:** Not Started

---

## Objective
Replace silent error swallowing in `JudgeService.runEvaluationPipeline()` with error aggregation that surfaces failures to the caller, complying with ARCHITECTURE.md §4.3 ("No Silent Failures").

## Context
- `src/core/services/judge-service.ts` lines 50–54: DB save failure is caught and only `console.error` logged — the caller never knows data was lost.
- `src/core/services/judge-service.ts` lines 57–63: Artifact export failure is similarly swallowed.
- ARCHITECTURE.md §4.3: "Do not swallow errors. Wrap I/O in try/catch blocks only when a recovery path exists."
- The recovery path DOES exist — the evaluation pipeline can continue without persistence/export — but the caller must be informed.

## Instructions

### Step 1 — Add an optional `errors` array to `EvaluationRunResult`
In `src/core/contracts.ts`, update the `EvaluationRunResult` interface (lines 416–420):
```ts
export interface EvaluationRunResult {
  candidateId: string;
  result: EvaluationResult;
  cost?: number;
  errors?: string[];  // ADD: non-fatal errors collected during evaluation
}
```

### Step 2 — Aggregate errors in `JudgeService.runEvaluationPipeline()`
In `src/core/services/judge-service.ts`, replace:
```ts
      try {
        this.repository?.save(runResult);
      } catch (error) {
        console.error(`Failed to persist run result for candidate ${candidate.id}:`, error);
      }
```
with:
```ts
      const errors: string[] = [];
      try {
        this.repository?.save(runResult);
      } catch (error) {
        const msg = `Failed to persist run result for candidate ${candidate.id}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(msg);
        errors.push(msg);
      }
```

And replace:
```ts
      if (result.regressionStatus === 'regressed' || result.regressionStatus === 'error') {
        if (this.failureArtifactExporter) {
          try {
            await this.failureArtifactExporter.exportForRun(runResult.runId);
          } catch (e) {
            console.error(`Failed to export artifacts for run ${runResult.runId}:`, e);
          }
        }
      }
```
with:
```ts
      if (result.regressionStatus === 'regressed' || result.regressionStatus === 'error') {
        if (this.failureArtifactExporter) {
          try {
            await this.failureArtifactExporter.exportForRun(runResult.runId);
          } catch (e) {
            const msg = `Failed to export artifacts for run ${runResult.runId}: ${e instanceof Error ? e.message : String(e)}`;
            console.error(msg);
            errors.push(msg);
          }
        }
      }
```

And change the push line from:
```ts
      results.push({ candidateId: candidate.id, result, cost });
```
to:
```ts
      results.push({ candidateId: candidate.id, result, cost, errors: errors.length > 0 ? errors : undefined });
```

### Step 3 — Verify
- Run `npm run typecheck` — must pass with zero errors.
- Run `npm run lint` — must pass with zero errors.
- Run `npx vitest run tests/core/services/judge-service.test.ts tests/integration/judge-persistence.test.ts` — all tests must pass.

## Acceptance Criteria
1. `EvaluationRunResult` has an optional `errors?: string[]` field.
2. DB save failures and artifact export failures are collected in `errors` and exposed on the returned `EvaluationRunResult`.
3. `console.error` still logs the failures for observability.
4. TypeScript typechecks cleanly, lint passes.
5. All existing `JudgeService` and `judge-persistence` tests pass without modification.
