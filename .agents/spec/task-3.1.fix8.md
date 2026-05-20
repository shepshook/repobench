# Task 3.1.FIX8: Implement Robust PtySession Lock and State Management

## Objective
Fix the race conditions and concurrency issues identified in `PtySession` by improving state transitions and the synchronization mechanism.

## Proposed Changes
- Ensure that `write()` operations queued *before* `close()` are processed or rejected gracefully, not failing with unexpected `PtySessionClosedError` if already accepted.
- Strengthen the `lock` chain to ensure atomicity of state transitions.
- Consider adding a "Pending" state if necessary for queued writes during closing.

## Deliverables
- Implementation of robust state machine in `PtySession`.
- Updated test cases in `tests/infrastructure/pty-attach-console.test.ts` to verify fix.
