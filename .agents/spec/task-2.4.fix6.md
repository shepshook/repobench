# Task 2.4.FIX6: Investigate and Fix Test Suite Failures

## Context
The full test suite run for Feature 2.4 resulted in multiple failures, including Docker connectivity errors (ENOENT //./pipe/docker_engine) and assertion failures in cache logic.

## Objectives
1. Verify Docker environment accessibility in the test runner.
2. Resolve `VolumeManager` assertion failures in cache logic.
3. Fix parsing errors in `tests/integration/sandbox-state-switch-invalidation.test.ts`.

## Action Items
- Check Docker engine status.
- Run `npm run test tests/infrastructure/` and `npm run test tests/integration/` separately to isolate failures.
- Fix assertion logic for cache hit/miss status.
- Ensure Docker volumes are created/cleaned up correctly.

## Audit Feedback Round 1
- **FAIL**: Type error in `src/infrastructure/sandbox.ts` at line 60: `resetStats()` is not defined in `IVolumeManager` interface in `src/core/contracts.ts`.
- **FAIL**: Test quality issue in `tests/integration/sandbox-state-switch-invalidation.test.ts` (lines 35-40): `switchState` errors are silently ignored via `try/catch`, violating the "No Silent Failures" architecture principle.
- **Action Required**: Add `resetStats(): void` to `IVolumeManager` or implement `VolumeManager` without requiring its usage in `Sandbox`'s `init()` if possible. Remove silent `try/catch` from test and handle errors explicitly.


## Audit Feedback Round 3
- **FAIL**: Test quality issue persists in `tests/integration/sandbox-state-switch-invalidation.test.ts` (lines 35-40): `switchState` errors are still silently ignored via `try/catch`, violating the "No Silent Failures" architectural principle. This must be fixed to ensure the test accurately asserts the success of `switchState`.

## Audit Feedback Round 4
- **FAIL**: Test quality issue persists in `tests/integration/sandbox-state-switch-invalidation.test.ts` (lines 35-40): `switchState` errors are still silently ignored via `try/catch`, violating the "No Silent Failures" architectural principle. The implementation still does not adhere to the requirement of explicit error handling for I/O operations (Docker/Git) as defined in ARCHITECTURE.md. Please remove the `try/catch` block and handle the potential error by either asserting it, or expecting the test to fail correctly when `switchState` fails.

## Audit Feedback Round 5
- **FAIL**: The `try/catch` block in `tests/integration/sandbox-state-switch-invalidation.test.ts` (lines 35-40) remains, continuing to violate the "No Silent Failures" architectural principle specified in `ARCHITECTURE.md`. You must remove the `try/catch` and explicitly handle the potential error (e.g., `await expect(sandbox.switchState(HASH_2)).rejects.toThrow()` or just removing the try/catch to let it fail, as appropriate for the test's intent) to ensure visibility of failures.

## Audit Feedback Round 6
- **FAIL**: The `try/catch` block in `tests/integration/sandbox-state-switch-invalidation.test.ts` (lines 35-40) still exists. This silent handling of I/O errors violates the "No Silent Failures" principle in `ARCHITECTURE.md` (Section 4.3), which mandates throwing descriptive errors. The test must be updated to explicitly handle potential failures instead of silencing them.


