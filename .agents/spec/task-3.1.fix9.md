# Task 3.1.FIX9: Update PtySession Tests to Assert Concurrent Safety

## Objective
Update the reproduction tests in `tests/infrastructure/pty-attach-console.test.ts` to adhere to proper `async`/`await` patterns and ensure they properly test concurrent safety without false failures.

## Proposed Changes
- Ensure all calls to `session.close()` are `awaited`.
- Add tests to ensure that `write()` operations called just before `close()` are handled consistently (either fully processed or properly rejected without throwing an unhandled `PtySessionClosedError` if already accepted).

## Deliverables
- Cleaned up, robust tests for PTY session concurrency.
- Test suite passes consistently.
