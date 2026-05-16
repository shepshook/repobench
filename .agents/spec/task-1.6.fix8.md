# Task 1.6.FIX8: Fix Database Initialization in Integration Tests

## Description
Several integration tests in `tests/integration/` are incorrectly using `initDatabase()` instead of `reinitDatabase()` to configure the temporary database for testing. This causes tests to either interact with the wrong database or not properly isolate themselves, leading to flaky tests and potential data corruption.

## Instructions
1.  **Locate affected files**: Identify `tests/integration/import-jsonl.test.ts` and `tests/integration/export-jsonl.test.ts`.
2.  **Refactor**: Update these files to import `reinitDatabase` from `../../src/infrastructure/persistence/database` and call `reinitDatabase(tempDbPath)` instead of `initDatabase(tempDbPath)` in the `beforeEach` hook.
3.  **Verify**: Run `npm run test` and ensure all tests pass and are isolated.

## Audit Feedback Round 1
FAIL: The integration tests `tests/integration/import-jsonl.test.ts` and `tests/integration/export-jsonl.test.ts` still use `initDatabase` instead of `reinitDatabase` in their `beforeEach` hooks as required by the task instructions. Please refactor these files to import `reinitDatabase` and use it for database initialization.

## Audit Feedback Round 2
FAIL: `tests/integration/export-jsonl.test.ts` still does not use `reinitDatabase` in its `beforeEach` hook. While `tests/integration/import-jsonl.test.ts` has been updated, `tests/integration/export-jsonl.test.ts` needs to be refactored to import `reinitDatabase` and use it for database initialization in `beforeEach` as specified in the task description.
