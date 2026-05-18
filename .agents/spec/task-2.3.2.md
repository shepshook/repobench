# Task 2.3.2: Implement Sandbox.switchState using git checkout

## Objective
Implement the `switchState` method in the `Sandbox` class to perform a `git checkout` to the provided commit hash.

## Scope
- `src/infrastructure/sandbox.ts`

## Acceptance Criteria
- `switchState` executes `git checkout <hash>` inside the container.
- Implement a strategy for handling dirty working directories (e.g., `git reset --hard`).
- Use an internal `currentHash` property to track state and avoid redundant checkouts.
- Implement robust error handling for `git` commands, translating non-zero exit codes into specific domain exceptions (e.g., `GitOperationError`).
- Use `zod` to validate the commit hash format before execution.
- Log the state switch action.
