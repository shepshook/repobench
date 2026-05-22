# Task 5.3.2: Implement LeaderboardReporter Service & Tests

## Context
- Module: `src/core/services/leaderboard-reporter.ts` and `src/core/contracts.ts`
- Requirement: Feature 5.3 (CLI Leaderboard View)
- Goal: Implement the aggregation service that queries `IRunResultRepository` and computes per-agent leaderboard entries.

## Technical Directive
1. Create `src/core/services/leaderboard-reporter.ts`:
   - Export class `LeaderboardReporter` implementing `ILeaderboardReporter`.
   - Constructor takes `IRunResultRepository`.
   - `getLeaderboard(options)`:
     1. Fetch all `RunResult[]` from the repository.
     2. Apply optional `agentId` / `candidateId` filters.
     3. Group by `agentId`, compute per-agent:
        - `totalRuns` — count of results
        - `successfulRuns` — count where `metrics.success === true`
        - `failedRuns` — `totalRuns - successfulRuns`
        - `successRate` — `successfulRuns / totalRuns`
        - `avgEScore` — mean of `metrics.eScore`
        - `avgCost` — mean of `metrics.cost`
        - `avgLatency` — mean of `metrics.latency`
     4. Sort by `sortBy` column in `sortOrder` direction.
     5. Assign `rank` sequentially (1-based).
     6. Apply `limit` and return `LeaderboardEntry[]`.
   - Edge cases:
     - Empty results: return `[]`.
     - All failures / zero runs: `successRate` is `0`.
     - Single agent: single-entry leaderboard.
2. Create `tests/core/services/leaderboard-reporter.test.ts`:
   - Mock `IRunResultRepository` with canned `RunResult[]` data.
   - Verify aggregation math (counts, averages, success rate).
   - Verify sorting by each `sortBy` column in both orders.
   - Verify `limit` truncation.
   - Verify filtering by `agentId`.
   - Verify empty result set returns `[]`.
   - Verify rank assignment is sequential.

## DoD
- `LeaderboardReporter` implements `ILeaderboardReporter` contract.
- Aggregation handles edge cases (empty data, single agent, all failures).
- Sorting and filtering work correctly.
- All unit tests pass (`npx vitest run tests/core/services/leaderboard-reporter.test.ts`).
- `npm run typecheck && npm run lint` pass.
