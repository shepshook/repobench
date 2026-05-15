# Task 1.2.4: Pipeline Integration

## Context Map
- `src/core/services/miner.ts`: `GitMiner.mineCommits` logic.
- `src/core/services/filters/significance-filter.ts`: `BasicSignificanceFilter`.
- `src/core/contracts.ts`: `ISignificanceFilter`.

## Technical Directive
1. Update `GitMiner` constructor to accept an optional `ISignificanceFilter` (defaulting to `BasicSignificanceFilter`).
2. In `GitMiner.mineCommits`, apply the significance filter as the final step of the pipeline:
   `Keyword Filter` $\rightarrow$ `Path Filter` $\rightarrow$ `Significance Filter`.
3. Ensure that only commits passing the significance filter are returned as candidates.
4. Update `tests/integration/mine.test.ts` to verify that the filter is active and correctly removing noise during a real mining run.

## DoD
- `GitMiner` is integrated with `ISignificanceFilter`.
- Integration tests verify that insignificant commits are excluded from the final result.
- `npm run typecheck` passes.
