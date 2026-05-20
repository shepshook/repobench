# Task 3.1.FIX3: Improve PTY Test Robustness

## Description
Address test timeouts and intermittent failures observed in the `PtySession` integration tests.

## Objectives
- [ ] Implement appropriate `testTimeout` configurations for long-running PTY interaction tests.
- [ ] Ensure that `PtySession` gracefully handles process lifecycle events, preventing orphaned or hanging processes.
- [ ] Add explicit checks for terminal readiness before sending input.

## Success Criteria
- Tests do not time out under reasonable load.
- No hanging processes detected after test completion.

## Audit Feedback Round 1
- The implementation of `PtySession.close()` seems to correctly attempt process termination.
- However, the robustness test `tests/infrastructure/pty-session-robustness.test.ts` (specifically `should not leave orphaned background processes after closing`) is logically flawed. It expects `psOutputPromise` to resolve to detect the process, but if the process is already gone, it hits the timeout rejection, causing the test to fail.
- Please refactor this test to correctly verify the absence of the orphaned process without relying on the timeout rejection to represent a "passing" state.
