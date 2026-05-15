# Task 1.1.3: Keyword & Path Filtering Logic

## Context Map
- `src/core/services/miner.ts`: Update `GitMiner.mineCommits`.
- `src/core/config.ts`: Access `RepoBenchConfig`.

## Technical Directive
1. Modify `GitMiner.mineCommits` to apply filters before returning candidates.
2. **Keyword Filter**: A commit is kept if its message contains any of the strings in `config.mining.keywords` (case-insensitive).
3. **Path Filter**: A commit is discarded if ALL of its affected files match the patterns in `config.mining.exclude_paths`.
4. Ensure the filtering logic is efficient and doesn't crash on empty keyword lists.

## Testing
- Write unit tests for the filtering logic in `tests/core/miner.test.ts`:
  - Case-insensitive keyword match: Commit message "Fix bug" matches "fix".
  - Path filter (Discard): All files in commit are in `exclude_paths`.
  - Path filter (Keep): At least one file in commit is NOT in `exclude_paths`.
  - No keywords: If `keywords` is empty, all commits (that pass path filter) are kept.
