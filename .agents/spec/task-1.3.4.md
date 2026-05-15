# Task 1.3.4: GitMiner Integration

## Context
- Module: `core/services/miner.ts`
- Requirement: Feature 1.3
- Goal: Connect `GitMiner` to persistence.

## Technical Directive
1. Update `GitMiner` constructor to require `ICandidateRepository`.
2. In `mineCommits`, after significance check:
   - `if (!repository.exists(hash)) { repository.save(candidate); }`

## DoD
- Integration complete.
- Duplicates handled.
