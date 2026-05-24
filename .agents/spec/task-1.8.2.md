# Task 1.8.2: Re-enable `since` Date Parameter in CLI

## Context Map
- `src/cli/mine.ts`: Currently overrides the user-provided `since` to `undefined` as a workaround for the simple-git revision-range bug.
- `src/core/services/miner.ts`: Updated in Task 1.8.1 to support `--since` via `execFile`.

## Technical Directive
1. In `src/cli/mine.ts`, remove the line that sets `since = undefined` (or the override that nullifies the parsed config value).
2. Ensure the `since` value from `repobench.yaml` (under `mining.since`) or from the CLI `--since` flag flows through to `GitMiner.mineCommits(options)`.
3. Validate the `since` format as an ISO-8601 date string at the CLI level before passing it downstream. Reject with a clear error message if invalid.

## Testing
- Update CLI integration tests for `mine`:
  - Test `--since 2025-01-01` returns commits filtered by date.
  - Test `--since` with invalid date shows a helpful error.
- All existing miner and CLI tests must pass.
