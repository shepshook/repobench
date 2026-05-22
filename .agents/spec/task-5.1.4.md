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


## Audit Feedback Round 1
The implementation of `runEvaluationPipeline` in `JudgeService` utilizes complex, fragile, and non-idiomatic variadic argument handling instead of the explicitly specified interface signature. This deviates from the technical directive, resulting in tests that require `@ts-ignore` to bypass type errors, violating the project's standards for type safety and maintainability. The `IJudgeService` interface and its implementation MUST be refactored to use explicitly defined, non-overloaded parameters as specified.

## Audit Feedback Round 2
The implementation of `runEvaluationPipeline` in `JudgeService` continues to use non-idiomatic variadic argument handling (`...(cost !== undefined ? [cost] : [])`) to invoke `this.evaluator.evaluate`. Given that `cost` is already typed as `number | undefined` and the `IEvaluator.evaluate` signature defines `cost` as an optional parameter (`cost?: number`), the spread operator is both unnecessary and complicates type safety. Refactor the `evaluator.evaluate` invocation to pass `cost` directly.

## ESCALATION DIRECTIVE

**Root Cause:** One-line style regression persists across 2 review rounds.

### Fix 1 — Replace variadic spread with direct pass (`src/core/services/judge-service.ts:30-33`)
```
// OLD (line 32):
      const result = await this.evaluator.evaluate(
        candidate,
        ...(cost !== undefined ? [cost] : []),
      );
// NEW:
      const result = await this.evaluator.evaluate(
        candidate,
        cost,
      );
```
`cost` is `number | undefined`; `evaluate(candidate, cost?)` accepts `undefined` natively. No conditional spread needed.

### Fix 2 — Remove dead `@ts-ignore` (`tests/core/services/judge-service.test.ts:218`)
```diff
-      // @ts-ignore
       const results = await judge.runEvaluationPipeline([mockCandidate], agentId);
```
The `runEvaluationPipeline` signature `(Candidate[], string, Map?, string?)` accepts this call without error — the `@ts-ignore` is a leftover from a previous variadic interface.

### Verification
```bash
npm run typecheck && npm run lint
```
Then run the JudgeService unit tests:
```bash
npx vitest run tests/core/services/judge-service.test.ts
```
