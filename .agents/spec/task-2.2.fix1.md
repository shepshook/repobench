# Task 2.2.FIX1: Audit SandboxManager cleanupOrphanedContainers error handling

## Objective
The `cleanupOrphanedContainers` method in `SandboxManager` currently throws an error if any single container cleanup operation fails, even if it attempted to clean up others. This causes the test `should guarantee teardown of all resources even if some stop operations fail` to fail because it expects partial failures to not stop the entire cleanup process or at least to be handled gracefully.

## Plan
1. Audit `cleanupOrphanedContainers` error handling logic in `src/infrastructure/sandbox/sandbox-manager.ts`.
2. Modify `cleanupOrphanedContainers` to ensure that a failure in one container cleanup does not prevent the cleanup of other containers.
3. Determine if we should throw a collective error at the end or log the failures and continue.
4. Update `tests/infrastructure/sandbox/sandbox-manager.test.ts` to assert the expected behavior for partial failures.

## DoD
- `npm run test` passes for `SandboxManager`.
- All orphaned containers are attempted to be cleaned up, regardless of individual operation failures.
- `cleanupOrphanedContainers` behavior regarding error propagation is clearly defined and tested.
