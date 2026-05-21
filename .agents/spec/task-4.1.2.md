# Task 4.1.2: Implement RegressionTestRunner Service

## Goal
Implement the `RegressionTestRunner` service based on the `IRegressionTestRunner` interface defined in 4.1.1.

## Requirements
- Implement `RegressionTestRunner` class.
- Leverage `ISandbox.execute` (using `container.exec()` per `ARCHITECTURE.md` §6) to run the `test_command` in batch mode (avoid PTY).
- Implement `compareResults` logic to detect regressions (tests passing in pre-fix but failing in post-fix).
- Adhere to error handling standards (`try/catch` with descriptive errors).

## DoD
- Service is implemented.
- Logic correctly executes test commands and parses/compares results.

## Audit Feedback Round 1
- **Status**: FAIL
- **Finding**: The `RegressionTestRunner` service implementation is missing from the codebase.
- **Details**: `src/core/services/regression-test-runner.ts` does not exist. However, `tests/core/services/regression-test-runner.test.ts` exists, suggesting the implementation might have been deleted, never implemented, or placed in an incorrect location.

## Audit Feedback Round 2
- **Status**: FAIL
- **Finding**: The `RegressionTestRunner` service implementation remains missing.
- **Details**: `src/core/services/regression-test-runner.ts` still does not exist, while `tests/core/services/regression-test-runner.test.ts` exists. The service needs to be implemented in the correct location (`src/core/services/regression-test-runner.ts`) to satisfy the Definition of Done (DoD).

## ESCALATION DIRECTIVE

### Root Cause
The `RegressionTestRunner` class was **never implemented**. The contract (`IRegressionTestRunner` in `contracts.ts:235-238`) and the test suite (`tests/core/services/regression-test-runner.test.ts`) were created during Task 4.1.1/TDD, but the implementation file was deleted or never created. Two prior audit rounds re-detected the same gap but did not generate the fix.

### Fix Applied
Created `src/core/services/regression-test-runner.ts` with:

- **`class RegressionTestRunner implements IRegressionTestRunner`** — no constructor args (matches test: `new RegressionTestRunner()`)
- **`runTests(sandbox, command)`** — calls `sandbox.execute(command, { timeout: 300_000 })`, captures `duration`, derives `passed` from `exitCode === 0`, wraps error with descriptive message
- **`compareResults(pre, post)`** — maps `(!prePassed && postPassed)` → `'improved'`, `(prePassed && !postPassed)` → `'regressed'`, all other combos → `'unchanged'`; `diff` and `summary` are always populated (matching test assertions)

### Verification
1. Run `npx vitest run tests/core/services/regression-test-runner.test.ts` — all 7 tests must pass.
2. Run `npm run typecheck && npm run lint` — zero errors.
3. Check `src/core/services/regression-test-runner.ts` exists and exports `RegressionTestRunner`.
