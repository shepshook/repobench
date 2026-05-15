# Task 1.5.3: Integration with Candidate Pipeline

## Context Map
- `src/core/services/miner.ts`: `GitMiner` (the main orchestration loop).
- `src/core/services/benchmark-validator.ts`: `BenchmarkValidator`.
- `src/core/contracts.ts`: `Candidate` status (`pending`, `validated`, `rejected`).
- `src/core/contracts.ts`: `ICandidateRepository`.

## Technical Directive
1. Update `GitMiner` to accept an `IBenchmarkValidator` via constructor.
2. Integrate the validator into the mining loop (after curation):
    - For each curated and approved candidate:
        - Call `validator.validate(candidate)`.
        - If `result.isValid`:
            - Update candidate status to `validated`.
        - Else:
            - Update candidate status to `rejected`.
        - Update the status in the database via `ICandidateRepository`.
3. Ensure the process is sequential to avoid overwhelming Docker resources.
4. **Pipeline Filter**: Ensure that only candidates with `status: 'validated'` are passed to the subsequent orchestrator stages.

## DoD
- [ ] `GitMiner` correctly invokes the validator for approved candidates.
- [ ] Candidates in the database have their status updated to `validated` or `rejected` based on validation results.
- [ ] Integration tests confirm the end-to-end flow: Mine $\rightarrow$ Curate $\rightarrow$ Validate $\rightarrow$ Save.
