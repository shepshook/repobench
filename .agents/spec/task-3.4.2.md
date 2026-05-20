# Task 3.4.2: Implement DoneDetector service with regex scanning
**Objective:** Implement the `DoneDetector` service that scans PTY output for completion signatures.
**Requirements:**
- Implement `DoneDetector` class implementing `IDoneDetector`.
- Subscribe to `PtySession` output streams.
- Scan for defined `CompletionSignature`s.
- Emit a 'done' event when a signature matches.
- Throw descriptive errors if initialization fails.
- **Testing:** Include unit tests to verify detection across various stdout patterns and edge cases.
**DoD:** `DoneDetector` correctly triggers on simulated output containing completion strings; unit tests pass.

## Audit Feedback Round 1
- **Status**: FAIL
- **Reviewer**: CRITICAL_REVIEWER
- **Feedback**: 
  - The `DoneDetector` implementation violates the architectural requirement for error handling (Section 4.3). Specifically, catching errors during regex compilation and silently falling back to a substring match (`includes`) is "hope-based" error handling. It masks invalid user configurations instead of bubbling the error up to the orchestrator for RCA.
  - Fix: Remove the `try/catch` block around regex compilation. If the provided regex is invalid, the constructor or `setSignatures` method should validate the regex upon input, throwing a descriptive error immediately. Do not defer error detection to the `isDone` call.
