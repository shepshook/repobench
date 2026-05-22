# Task 5.1.3: Implement RunResultRepository

## Context
- Module: `src/core/repositories/run-result-repository.ts`
- Requirement: Feature 5.1 (Results Persistence Layer)
- Goal: Implement `IRunResultRepository` and verify with tests.

## Technical Directive
1. Create `src/core/repositories/run-result-repository.ts` implementing `IRunResultRepository` from contracts.
2. Use the existing `db` helper from `../../infrastructure/persistence/database.ts` for SQL operations.
3. Create `tests/core/repositories/run-result-repository.test.ts`.
4. Test suite must cover:
   - `save` (insert and verify)
   - Duplicate detection / upsert behavior
   - `getById` (found and not-found cases)
   - `getAll` (empty table and populated table)
   - `getByAgentId`
   - `getByCandidateId`
5. Use temporary database via `reinitDatabase` test helpers to avoid state leak.

## DoD
- All repository methods are functional.
- Tests pass under `npm run test`.
