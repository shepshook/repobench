# Task 5.3.1: Define Leaderboard Query Contract & Options Schema

## Context
- Module: `src/core/contracts.ts`
- Requirement: Feature 5.3 (CLI Leaderboard View)
- Goal: Define the data contracts for querying and aggregating run results into a leaderboard view.

## Technical Directive
1. Add `LeaderboardOptions` schema to `src/core/contracts.ts`:
   - `sortBy: z.enum(['eScore', 'successRate', 'cost', 'latency', 'runs']).default('eScore')` — primary sort column
   - `sortOrder: z.enum(['asc', 'desc']).default('desc')` — sort direction
   - `limit: z.number().int().positive().default(10)` — max entries in report
   - `agentId: z.string().optional()` — filter to a single agent
   - `candidateId: z.string().uuid().optional()` — filter to a single candidate
2. Define `LeaderboardEntry` interface:
   - `rank: number` — position in sorted leaderboard
   - `agentId: string`
   - `totalRuns: number`
   - `successfulRuns: number`
   - `failedRuns: number`
   - `successRate: number` — `successfulRuns / totalRuns` (0–1)
   - `avgEScore: number`
   - `avgCost: number`
   - `avgLatency: number`
3. Define `ILeaderboardReporter` interface:
   - `getLeaderboard(options: LeaderboardOptions): Promise<LeaderboardEntry[]>` — query and aggregate
4. Do NOT modify existing `AgentRunSummary`, `BatchRunSummary`, or `IRunResultRepository` interfaces.

## DoD
- `LeaderboardOptions` schema exists with all fields and defaults.
- `LeaderboardEntry` interface has all required fields.
- `ILeaderboardReporter` interface is declared.
- `npm run typecheck` passes.
