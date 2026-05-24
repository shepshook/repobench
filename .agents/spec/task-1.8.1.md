# Task 1.8.1: Replace simple-git `LogOptions` with `child_process.execFile` for Raw Git Log

## Context Map
- `src/core/services/miner.ts`: Current `GitMiner.log` implementation uses `simple-git`'s `LogOptions.from` which maps to a revision range, not `--since`.
- `src/core/contracts.ts`: `IMiner` interface.
- `src/cli/mine.ts`: CLI entry point that passes `since` as undefined (workaround).

## Technical Directive
1. In `src/core/services/miner.ts`, replace the `simple-git` `log()` call with `child_process.execFile('git', [...])` for the `mineCommits` method:
   - Use `child_process.execFile` to avoid shell injection from user-provided date strings.
   - Construct args: `['log', `--since="${since}"`, '--format=%H|%ai|%s', '--reverse']` when `since` is provided; omit `--since` when undefined.
   - Parse the stdout lines, splitting on `|` delimiter (commit hash, author date, subject).
   - Keep `simple-git` for non-analytics git operations (status, checkout, diff) where its abstraction is valuable.
2. Preserve all existing filtering logic (keyword, path, significance) — only change the data source.
3. Type the parsed result to match `DefaultLogFields[]` or a minimal subset required by the filter chain.

## Testing
- Add integration tests in `tests/core/miner.test.ts`:
  - Test mining with a `since` date (should return only commits after that date).
  - Test mining without `since` (should return all history).
  - Verify keyword filtering still works with the new data source.
- All existing miner unit tests must pass unchanged.
