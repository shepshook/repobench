# Task 1.2.2: Pure-Fix Heuristics Implementation

## Context Map
- `src/core/services/miner.ts`: Update `GitMiner.mineCommits`.
- `src/core/services/filters/significance-filter.ts`: Use `BasicSignificanceFilter`.

## Technical Directive
1. Integrate `ISignificanceFilter` into `GitMiner`.
2. In `GitMiner.mineCommits`, after the keyword and path filters, apply the significance filter to each candidate.
3. Only candidates that are deemed "significant" should be added to the final list.
4. Ensure the filter is applied as the final stage of the mining pipeline.

## DoD
- `GitMiner` correctly uses `BasicSignificanceFilter`.
- Integration tests in `tests/integration/mine.test.ts` are updated to include "insignificant" commits (e.g., whitespace only) and verify they are filtered out.
