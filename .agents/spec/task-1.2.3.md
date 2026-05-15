# Task 1.2.3: Noise Reduction & Filter Tuning

## Context Map
- `src/core/services/filters/significance-filter.ts`: Refine logic.
- `tests/core/filters/significance-filter.test.ts`: Add edge cases.

## Technical Directive
1. Refine the `BasicSignificanceFilter` to handle a wider range of "noise":
   - Ignore changes to lock files (`package-lock.json`, `yarn.lock`).
   - Ignore changes to common documentation files.
2. Implement a "Purity Threshold":
   - A commit is discarded if it modifies more than 5 files (configurable).
   - A commit is discarded if the total lines changed exceed a certain threshold (e.g., 50 lines).
3. Implement a "Minimum Change" threshold (e.g., a commit must change at least one line of actual code).
4. Add test cases for these noise types to ensure they are correctly filtered out.

## DoD
- `BasicSignificanceFilter` correctly filters out lock files and docs.
- Purity thresholds (file count, line count) are implemented and verified.
- Minimum change threshold is implemented and verified.
