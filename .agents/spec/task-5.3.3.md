# Task 5.3.3: Implement Terminal Table Renderer for Report Output

## Context
- Module: `src/core/services/report-renderer.ts`
- Requirement: Feature 5.3 (CLI Leaderboard View)
- Goal: Build a terminal-friendly table renderer that displays ranked agent performance.

## Technical Directive
1. Add `IReportRenderer` interface to `src/core/contracts.ts`:
   - `render(entries: LeaderboardEntry[]): string` — return a formatted table string
2. Create `src/core/services/report-renderer.ts`:
   - Export class `TerminalReportRenderer` implementing `IReportRenderer`.
   - Render a formatted table with columns using aligned column layout:
     ```
     Rank | Agent ID       | Runs | Passed | Failed | Success Rate | Avg E-Score | Avg Cost | Avg Latency
     ─────┼────────────────┼──────┼────────┼────────┼──────────────┼─────────────┼──────────┼─────────────
       1  | aider          |   12 |     10 |      2 |       83.33% |       0.784 |    $0.45 |     182.3s
       2  | claude-code    |   12 |      8 |      4 |       66.67% |       0.612 |    $0.62 |     245.1s
     ```
   - Use `console.table` as fallback if terminal width detection fails.
   - Handle empty entries: return `"No data available."`.
   - Format success rate as percentage with 2 decimal places.
   - Format cost as currency (`$X.XX`).
   - Format latency in seconds with 1 decimal place.
   - Format E-Score with 3 decimal places.
3. Create `tests/core/services/report-renderer.test.ts`:
   - Verify rendered output contains all column headers.
   - Verify correct value formatting (percent, currency, seconds).
   - Verify empty entries return "No data available.".
   - Verify the table includes the rank column and correct ordering.

## DoD
- `IReportRenderer` interface is defined in `contracts.ts`.
- `TerminalReportRenderer` produces a correctly formatted table string.
- All unit tests pass (`npx vitest run tests/core/services/report-renderer.test.ts`).
- `npm run typecheck && npm run lint` pass.
