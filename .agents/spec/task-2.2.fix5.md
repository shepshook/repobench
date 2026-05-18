# Task 2.2.FIX5: Reconcile SandboxManager cleanupOrphanedContainers Error Handling with Tests

## Objective
The `cleanupOrphanedContainers` method in `SandboxManager` currently throws an error if any container operation (stop/remove/inspect) fails. The current test suite (`tests/infrastructure/sandbox/sandbox-manager-fix2.test.ts`) expects the method to *not* throw in these scenarios, and instead presumably proceed with remaining containers and log errors (as tested in `tests/infrastructure/sandbox/sandbox-manager-fix2-logging.test.ts`). Reconcile this discrepancy to either match the tests' expectation of non-throwing partial completion, or update the tests to reflect the desired production behavior.

## Implementation Details
1. Review `src/infrastructure/sandbox/sandbox-manager.ts` and the failing tests.
2. Decide on the correct error handling strategy:
    a) If non-throwing is desired: Update `cleanupOrphanedContainers` to log errors instead of throwing, and ensure the `errors` array is populated.
    b) If throwing is desired: Update the tests to assert that `cleanupOrphanedContainers` throws when errors occur.
3. Update `SandboxManager.cleanupOrphanedContainers` and/or `tests/infrastructure/sandbox/sandbox-manager-fix2*.test.ts`.
4. Ensure all tests in `tests/infrastructure/sandbox/` pass.

## Audit Feedback Round 1
The task is pending, but the current implementation violates the architectural requirement of 'No Silent Failures' (ARCHITECTURE.md Section 4.3).

1. **Architecture Violation**: `SandboxManager.cleanupOrphanedContainers` swallows errors by logging to `console.error` instead of throwing a consolidated error. This makes the system fail silently to the caller.
2. **Reconciliation**: The reconciliation should favor the architecture, not the existing incorrect test behavior.
3. **Requirement**: Refactor `cleanupOrphanedContainers` to collect errors (following the pattern established in `killTimedOutContainers`) and throw a consolidated error if any operations fail. Update all related tests in `tests/infrastructure/sandbox/` to assert that these errors are thrown, rather than asserting that they are not.

## Audit Feedback Round 2
The implementation of `SandboxManager.cleanupOrphanedContainers` in `src/infrastructure/sandbox/sandbox-manager.ts` now correctly adheres to the Architecture requirements by collecting errors and throwing a consolidated error.

1. **Test Failure**: The associated tests in `tests/infrastructure/sandbox/sandbox-manager-fix2.test.ts` still expect `cleanupOrphanedContainers` to *not* throw, causing them to fail.
2. **Task Incomplete**: The task is not finished because the tests do not pass. The tests must be updated to expect the errors to be thrown.

