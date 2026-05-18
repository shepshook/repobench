# Task 2.2.FIX3: Consolidate Error Handling in SandboxManager

## Goal
Modify `SandboxManager.cleanupOrphanedContainers` to throw an aggregated error instead of only logging errors when cleanup fails for one or more containers.

## Implementation Details
1. Open `src/infrastructure/sandbox/sandbox-manager.ts`.
2. Locate `cleanupOrphanedContainers`.
3. Instead of only `console.error` when `errors.length > 0`, construct an aggregate error (or a single Error with all messages joined) and throw it.
4. Ensure all collected errors are preserved in the thrown error.
