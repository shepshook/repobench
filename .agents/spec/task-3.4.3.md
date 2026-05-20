# Task 3.4.3: Implement session-level timeout mechanism in PtySession
**Objective:** Implement session-level timeout management in `PtySession` to prevent runaway sessions.
**Requirements:**
- Add timeout support to `PtySession` configuration.
- Implement a timer that resets on activity.
- Terminate session and emit a 'timeout' event if the timer expires.
- Throw descriptive errors if timeout/cleanup fails.
- **Testing:** Include integration tests verifying that sessions terminate correctly after configurable inactivity.
**DoD:** Sessions are automatically terminated after configurable inactivity; integration tests pass.

## Audit Feedback Round 1
The implementation of the timeout mechanism in `PtySession` appears functional in the code.
However, the requirement regarding integration tests for the timeout mechanism (point 8 in Requirements, DoD) is NOT met. There is no active test verifying that sessions terminate correctly after configurable inactivity in `tests/infrastructure/pty-session.test.ts`.
