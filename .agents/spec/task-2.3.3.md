# Task 2.3.3: Add verification tests for state switching

## Objective
Add tests to verify that `switchState` successfully changes the repository state within the sandbox.

## Scope
- `tests/infrastructure/sandbox.test.ts` (or similar)

## Acceptance Criteria
- Test case covers successful state switch.
- Test case covers error handling for invalid hashes.
- Test case covers switching while the working directory is "dirty" to verify the reset strategy.
- Test case covers redundant checkout prevention using `currentHash`.
