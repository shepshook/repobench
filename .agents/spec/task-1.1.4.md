# Task 1.1.4: Integration & CLI Command

## Context Map
- `src/cli/mine.ts`: (To be created) CLI entry point.
- `src/core/services/miner.ts`: Use `GitMiner`.
- `src/core/config.ts`: Use `loadConfig`.

## Technical Directive
1. Create `src/cli/mine.ts`.
2. Implement a main function that:
   - Calls `loadConfig()`.
   - Initializes `GitMiner`.
   - Calls `mineCommits(config)`.
   - Logs the total number of candidates found to the console.
3. Add a script to `package.json` to run this command (e.g., `"mine": `"node dist/cli/mine.js"`).

## Testing
- Create an integration test in `tests/integration/mine.test.ts`:
  - Setup a dummy git repository with some commits.
  - Run the `mine` command via `exec`.
  - Verify the output contains the expected number of candidates.
