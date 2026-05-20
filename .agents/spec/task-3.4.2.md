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
