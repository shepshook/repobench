# Task 3.3.3: Implement Response Injection & Synchronization
- **Objective**: Enable injecting responses into the PTY stream. Ensure injection is synchronized with PTY state to avoid race conditions.
- **Deliverable**: Update `PtySession` to support injected inputs, add synchronization checks.

## Audit Feedback Round 1
- **FAIL**: Task 3.3.3 is not implemented.
- **Feedback**:
  1. `injectResponse` method is missing from `IPtySession` interface in `src/core/contracts.ts`.
  2. `PtySession` implementation of `injectResponse` is missing in `src/infrastructure/pty-session.ts`.
  3. No explicit synchronization checks for injection are implemented as required by the spec.
