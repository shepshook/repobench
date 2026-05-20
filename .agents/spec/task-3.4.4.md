# Task 3.4.4: Integrate DoneDetector and timeout management into SessionOrchestrator
**Objective:** Wire up `DoneDetector` and the timeout mechanism into the `SessionOrchestrator`.
**Requirements:**
- Inject `IDoneDetector` into `SessionOrchestrator` to remain agent-agnostic.
- Update `SessionOrchestrator` to handle 'done' and 'timeout' events to cleanly terminate the session and finalize the run.
- Ensure cleanup logic is robust and throws descriptive errors on failure.
**DoD:** Orchestrator handles automatic completion and timeout transitions seamlessly without hardcoded agent signatures.
