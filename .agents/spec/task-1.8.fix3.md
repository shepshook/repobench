# Task 1.8.FIX3: Fix Candidate Schema Scope Creep — Make author_name/email/body Optional

## Context Map
- `src/core/contracts.ts`: `CandidateSchema` — `author_name`, `author_email`, `body` were added as `z.string()` (required), polluting the contract for all downstream consumers.
- `src/core/repositories/candidate-repository.ts`: `getById()` and `getAll()` add empty-string defaults for these fields on every retrieval, leaking internal parser artifacts.
- `src/infrastructure/jsonl-dataset-importer.ts`: Same empty-string defaults added during import mapping.
- `tests/core/repositories/candidate-repository.test.ts`: Two tests fail because:
  1. `should upsert and retrieve a candidate` — deep equality fails since retrieved object has extra `author_name`, `author_email`, `body` fields.
  2. `should not return snake_case properties` — `author_name` and `author_email` are snake_case keys that violate the test's assertion.

## Root Cause
Feature 1.8 replaced `simple-git.log()` (which populated `author_name`, `author_email`, `body` from parsed commit data) with `execFile('git', ['log', '--format=%H|%ai|%s', ...])` (which does not provide these fields). The fix was to set them to empty strings in the miner parser. However, these fields were then added to `CandidateSchema` as **required** (`z.string()`), which forced every Candidate consumer to provide them — including the repository layer when reading from the database. This is scope creep: the fields are internal parser artifacts, not part of the Feature 1.8 specification.

## Technical Directive
1. **In `src/core/contracts.ts`**: Change the three fields from required to optional:
   ```typescript
   author_name: z.string().optional(),
   author_email: z.string().optional(),
   body: z.string().optional(),
   ```

2. **In `src/core/repositories/candidate-repository.ts`**: Remove the empty-string defaults from both `getById()` and `getAll()`:
   - Delete lines: `author_name: '',`, `author_email: '',`, `body: '',`
   - The fields are optional in the schema; omitting them is valid.

3. **In `src/infrastructure/jsonl-dataset-importer.ts`**: Remove the same three empty-string defaults from the import mapping.

4. **DO NOT change** `src/core/services/miner.ts` — setting these to empty strings in the `GitLogEntry` parser is fine; optional fields accept empty string values.

## Verification
```bash
npm run typecheck
npm run lint
npx vitest run tests/core/repositories/candidate-repository.test.ts
npx vitest run tests/core/services/miner.test.ts tests/core/services/miner-logging.test.ts tests/integration/mine.test.ts
```
- `candidate-repository.test.ts`: All 5 tests pass (especially the `toEqual` deep-equality test and the snake_case assertion).
- All Feature 1.8 tests continue to pass.
- No `.agents/` files (ROADMAP, ARCHITECTURE) are modified by this task.
