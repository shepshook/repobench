# Task 5.3.4: CLI Integration (`repobench report`) & Verification

## Context
- Module: `src/cli/report.ts` and `src/cli/index.ts`
- Requirement: Feature 5.3 (CLI Leaderboard View)
- Goal: Add the `repobench report` CLI command that wires the aggregator and renderer together.

## Technical Directive
1. Create `src/cli/report.ts`:
   - Export `registerReportCommand(program: Command): void`.
   - Register `repobench report` with options:
     - `-s, --sort-by <column>` (default `'eScore'`) — sort column (`eScore`, `successRate`, `cost`, `latency`, `runs`)
     - `-o, --order <direction>` (default `'desc'`) — sort order (`asc` | `desc`)
     - `-l, --limit <number>` (default `10`) — max leaderboard entries
     - `-a, --agent-id <id>` (optional) — filter to specific agent
     - `-c, --candidate-id <uuid>` (optional) — filter to specific candidate
   - In the action handler:
     1. Initialize database (`initDatabase()`).
     2. Create `RunResultRepository` instance.
     3. Create `LeaderboardReporter` with the repository.
     4. Create `TerminalReportRenderer`.
     5. Parse `LeaderboardOptions` from provided CLI flags.
     6. Call `reporter.getLeaderboard(options)`.
     7. Print the rendered table to stdout.
     8. Exit with code 0.
   - Error handling: wrap in try/catch, print error message, exit with code 1.
2. Update `src/cli/index.ts`:
   - Import and call `registerReportCommand(program)`.
3. Create `tests/integration/report-cli.test.ts`:
   - Integration test that:
     - Seeds test `RunResult` data into the repository.
     - Invokes the CLI command programmatically.
     - Captures stdout and verifies table headers and data appear.
   - Test with `--sort-by successRate --order asc --limit 5`.

## DoD
- `repobench report` prints a sorted, ranked agent performance table.
- All CLI options (sort-by, order, limit, agent-id, candidate-id) work correctly.
- Exit code is 0 on success, 1 on error.
- Integration tests pass (`npx vitest run tests/integration/report-cli.test.ts`).
- `npm run typecheck && npm run lint` pass.

## Audit Feedback Round 1
The implementation of `repobench report` correctly wires the database, repository, and reporter, but the integration tests are failing due to incorrect assertions regarding sorting behavior.

- **Feedback**: The test `should respect --limit 5 and show at most 5 entries` in `tests/integration/report-cli.test.ts` incorrectly expects `agent-0` through `agent-4` to be present when sorting by `eScore` descending. Since the data is seeded with `agent-i` having `eScore = 0.5 + i * 0.05`, `agent-0` has the lowest `eScore` and should be excluded by the `--limit 5` filter. The assertion needs to be updated to expect `agent-5` through `agent-9` or the seeding data should be adjusted.
