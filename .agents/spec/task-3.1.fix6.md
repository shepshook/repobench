# Task 3.1.FIX6: Fix PTY Race Condition in Write/Close Round 1

## Objective
Implement a robust synchronization mechanism in `PtySession` to prevent `PtySessionClosedError` when `write()` and `close()` are called rapidly.

## Context
The current implementation relies on `this.closed` flag, which is checked at the start of `write()`. If `close()` is called, `this.closed` is set to `true` immediately. If a `write()` operation is already in the `lock` queue or triggered before the `lock` update, it fails.

## Requirements
1. Modify `PtySession` to allow `write()` operations to complete if they were queued *before* `close()` was called, or if they are in progress.
2. Update `close()` to wait for the `lock` promise to ensure all pending operations are finished or handled gracefully before fully closing the session.
3. Update unit tests in `tests/infrastructure/pty-windows-stress.test.ts` to verify that `write()` after `close()` handles the situation correctly (e.g., either by ignoring, queuing, or throwing a specific *expected* error, rather than an unhandled `PtySessionClosedError`).

## Deliverables
- Updated `src/infrastructure/pty-session.ts` with fixed synchronization.
- Updated stress tests to pass.
