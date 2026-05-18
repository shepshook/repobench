# Task 2.2.FIX4: Update SandboxManager Tests to Assert Rejection

## Goal
Update tests in `tests/infrastructure/sandbox/sandbox-manager.test.ts` and `tests/infrastructure/sandbox/sandbox-manager-failure.test.ts` to expect `cleanupOrphanedContainers` to reject.

## Implementation Details
1. Review test files that assert `cleanupOrphanedContainers` behavior.
2. Update assertions to use `await expect(sandboxManager.cleanupOrphanedContainers()).rejects.toThrow()` or similar to ensure they verify the rejection.
3. Ensure the error thrown contains the expected failure messages.
