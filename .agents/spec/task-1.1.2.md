# Task 1.1.2: Miner Interface & Basic Implementation

## Context Map
- `src/core/contracts.ts`: Define `IMiner` interface.
- `src/core/services/miner.ts`: (To be created) Implementation of `GitMiner`.

## Technical Directive
1. Add `IMiner` interface to `src/core/contracts.ts`:
   ```typescript
   export interface IMiner {
     mineCommits(config: RepoBenchConfig): Promise<Candidate[]>;
   }
   ```
2. Create `src/core/services/miner.ts`.
3. Implement `GitMiner` class implementing `IMiner`.
4. Use `simple-git` to:
   - Get commit history, respecting `config.mining.since` and `config.mining.limit`.
   - Extract commit hash, message, and affected files for each commit.
5. Map each commit to the `Candidate` type (defined in `src/core/contracts.ts`).

## Testing
- Write unit tests for `GitMiner` in `tests/core/miner.test.ts`:
  - Mock `simple-git` to return a set of commits.
  - Verify that `mineCommits` returns the correct number of `Candidate` objects.
  - Verify that `since` and `limit` filters are passed to the git log command.
