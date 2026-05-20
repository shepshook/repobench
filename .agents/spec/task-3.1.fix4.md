# Task 3.1.FIX4: Audit and Resolve PTY EPIPE Errors in Stress Tests

## Context
The test suite is failing with widespread `EPIPE` errors during PTY stress tests, particularly in `tests/infrastructure/pty-windows-stress.test.ts`. This suggests that the PTY implementation is not gracefully handling rapid write/close cycles on Windows under stress.

## Objective
- Investigate the root cause of `EPIPE` errors in PTY interactions.
- Implement robust error handling or rate-limiting for PTY write operations to prevent pipe breakage.
- Ensure all stress tests pass without `EPIPE` errors.

## Implementation Steps
1. Reproduce the failure by running `npm run test tests/infrastructure/pty-windows-stress.test.ts`.
2. Analyze `src/infrastructure/pty-session.ts` or related PTY infrastructure for missing error handling on `pty.write()` calls.
3. Apply fixes (e.g., buffering, retry logic, or graceful shutdown checks).
4. Run stress tests to verify the fix.

## DoD
- Stress tests pass consistently (`npm run test tests/infrastructure/pty-windows-stress.test.ts`).
- No `EPIPE` errors logged.

## Audit Feedback Round 1
- **Status**: FAIL
- **Feedback**: The implementation introduced regressions causing unhandled rejections (`Error: PTY session is closed`) during stress tests, leading to massive test suite failure. The fix for `EPIPE` errors in `src/infrastructure/pty-session.ts` appears to trigger prematurely on closed sessions rather than gracefully handling them. Re-evaluate `lock` and `closed` state transitions in `write()` and `close()`.
