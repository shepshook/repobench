# Task 3.1.FIX5: Audit PTY Concurrency Issues Round 1

## Objective
Analyze the race condition in `PtySession` between `write()` and `close()` operations that is causing `PtySessionClosedError` during stress tests.

## Context
The `tests/infrastructure/pty-windows-stress.test.ts` test `should not throw EPIPE when writing to a session that is closing` fails because `close()` sets `this.closed = true`, and subsequent `write()` calls throw `PtySessionClosedError` if `this.closed` is true, before checking if the operation could be completed.

## Tasks
1. Map out the `lock` promise chain in `PtySession` to understand how `write` and `close` are currently synchronized.
2. Identify why `close()` immediately sets `this.closed = true` rather than waiting for pending `write` operations.
3. Determine if `PtySessionClosedError` should be thrown if `close()` has already been *called* or only if the session is fully *closed*.

## Deliverables
- A concise summary of findings regarding the race condition in the `PtySession` implementation.
