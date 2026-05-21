# Task 4.3.2: Implement EScoreService

## Description
Implement the `EScoreService` to calculate E-Scores based on the defined formula.

## Specification
- Create `src/core/services/e-score-service.ts`.
- Implement `calculateEScore(runData: RunData): number` using the formula.
- **IMPORTANT**: Explicitly handle mathematical edge cases:
    - Handle `Cost = 0` and `log(Latency) = 0` (e.g., when `Latency = 1`) to avoid division by zero/Infinity.
    - Ensure `Latency > 0` (logarithm domain check).
    - Return a sane default or log a warning if calculation results in `NaN` or `Infinity`.

## DoD
- Service correctly implements the formula and handles edge cases.
