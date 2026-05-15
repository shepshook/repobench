# Task 1.5.4: Validation Reporting & Logging

## Context Map
- `src/core/services/benchmark-validator.ts`: `BenchmarkValidator`.
- `src/core/services/miner.ts`: `GitMiner`.
- `src/core/contracts.ts`: `ValidationResult`.

## Technical Directive
1. Update `GitMiner` to provide detailed logs for validation outcomes.
2. Logging requirements (must include `candidateId` and the test command executed):
    - Success: `Candidate [id] VALIDATED: Pre-fail, Post-pass`.
    - False Positive: `Candidate [id] REJECTED: Pre-pass (already fixed or not a bug)`.
    - Failed Fix: `Candidate [id] REJECTED: Post-fail (fix did not work)`.
    - Error: `Candidate [id] REJECTED: Sandbox error during validation`.
3. **RCA Requirement**: For any rejection, log the relevant `stdout`/`stderr` context from the `ValidationResult` to assist in debugging.
4. Log the `latency` for each validation run.

## DoD
- [ ] Console output shows detailed reasons for validation rejection.
- [ ] Latency for validation is logged for every candidate.
- [ ] Logs are human-readable and follow project patterns.
