# Task 3.5.4: Verification & Regression Testing

## Goal
Verify the cost extraction accuracy and ensure it doesn't break existing session orchestration.

## Tasks
- Create `src/core/services/cost-parser.test.ts`.
- Add unit tests for various log formats.
- Add integration tests ensuring `SessionOrchestrator` uses `CostParser` correctly.

## DoD
- Test suite covers edge cases (no output, partial output, multiple cost entries).
- Tests pass with 100% coverage for the `CostParser` logic.
