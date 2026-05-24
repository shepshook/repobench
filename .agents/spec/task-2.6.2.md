# Task 2.6.2: Update Database Initialization and Repository Consumers

## Context Map
- `src/infrastructure/database.ts`: Creates the `better-sqlite3` connection — currently uses a hardcoded or CWD-relative path.
- `src/core/repositories/candidate-repository.ts`: `CandidateRepository` — consumes `IDatabase`.
- `src/core/repositories/run-result-repository.ts`: `RunResultRepository` — consumes `IDatabase`.
- `src/infrastructure/database.ts`: Database bootstrap code including schema migrations.

## Technical Directive
1. Update `Database.init()` (or equivalent factory) in `src/infrastructure/database.ts` to accept a `dbPath: string` parameter instead of resolving it internally.
2. Wire the config-driven path from Task 2.6.1 through:
   - `src/core/config.ts` → config object → `loadConfig()` output
   - CLI entry points (`src/cli/index.ts`, `src/cli/mine.ts`, `src/cli/evaluate.ts`, `src/cli/run-all.ts`, `src/cli/report.ts`) to pass `config.database.path` to `Database.init()`
3. Ensure all three repository consumers (`CandidateRepository`, `RunResultRepository`) continue to receive the same `IDatabase` instance — no change needed there.
4. Remove the old CWD-relative path fallback from `Database.init()`.
5. Create the database parent directory at init time (not at config parse time) using `fs.mkdirSync` with `recursive: true`.

## Testing
- Add integration tests:
  - Test that a database created via `Database.init({ dbPath: '/tmp/test-repobench/repobench.db' })` writes to the correct path.
  - Test that existing repository operations (insert, query) work identically.
- Run full test suite to confirm no regression.

## Audit Feedback Round 1
The implementation for Task 2.6.2 has failed to meet the technical directives and maintain architectural integrity:

1. **Incomplete Directive Implementation (Directive 2 & 4)**: The directive required wiring `config.database.path` to `Database.init()` in all CLI entry points. While `src/cli/mine.ts` was updated, others (`src/cli/index.ts`, `src/cli/evaluate.ts`, etc.) still use the deprecated `initDatabase()` function, which retains the CWD-relative fallback path.
2. **Architectural Inconsistency**: The codebase now contains both the new `Database.init()` factory and the legacy `initDatabase()` function. This dual-approach violates the requirement to standardize on the new, configuration-driven database initialization.
3. **Action Required**: 
    - Deprecate and remove `initDatabase()` entirely to prevent further usage.
    - Refactor ALL CLI entry points (`src/cli/index.ts`, `src/cli/evaluate.ts`, etc.) to use `Database.init({ dbPath: config.database.path })`.
    - Ensure `config.database.path` is correctly loaded/resolved in all CLI entry points before `Database.init` is called.

## Audit Feedback Round 2
The implementation for Task 2.6.2 remains a FAIL for the following reasons:

1. **Inconsistent Status of Legacy Code**: While the CLI entry points now correctly use `Database.init()`, the legacy `initDatabase()` function remains in `src/infrastructure/persistence/database.ts`. It must be completely removed to enforce the mandated standardization.
2. **Persistent Fallbacks**: The CLI entry points continue to use fallback paths (e.g., `?? '~/.repobench/db/repobench.db'`) when the config is missing. Directive #4 implicitly demands a strictly configuration-driven approach. The configuration loading and validation should be centralized, and `Database.init` should not rely on fallbacks in the caller if the config is invalid or missing.
3. **Action Required**: 
    - Remove the `initDatabase()` function from `src/infrastructure/persistence/database.ts` entirely.
    - Remove the fallback paths from all CLI entry points (`src/cli/index.ts`, `src/cli/evaluate.ts`, etc.) and ensure `config.database.path` is strictly required. If config is missing, the application should fail explicitly rather than falling back to an unverified default path.

## Audit Feedback Round 3
The implementation remains a **FAIL**. The issues identified in Round 2 persist:

1. **Legacy Code Remains**: `src/infrastructure/persistence/database.ts` still contains the deprecated `initDatabase()` function (lines 122-125). This must be removed.
2. **Fallback Paths Persist**: CLI files still rely on `?? '~/.repobench/db/repobench.db'` fallback paths (e.g., `src/cli/index.ts` lines 35, 64). The configuration-driven approach requires strict path resolution using `resolveDatabasePath` without inline fallbacks.

**Action Required**: You must strictly apply the fixes documented in the "ESCALATION DIRECTIVE" of this spec. Do not deviate.

## ESCALATION DIRECTIVE

**This task is NOT blocked. Continue with Option (A).**

**Root cause of 2 failed rounds**: The implementer correctly fixed `src/cli/mine.ts` (the only file using `resolveDatabasePath()`) but **never applied the identical fix to the other 5 CLI files**, and **never removed `initDatabase()`**.

**Precise fix instructions — 5 files + 1 deletion:**

### Fix 1: Remove `initDatabase()` (database.ts)
Delete lines 122-125 from `src/infrastructure/persistence/database.ts`:
```ts
/** @deprecated Use Database.init() instead */
export function initDatabase(newDbPath?: string): void {
  Database.init({ dbPath: newDbPath ?? '~/.repobench/db/repobench.db' });
}
```

### Fix 2–6: Replace fallback patterns in all CLI files
In each file below, replace:
```ts
Database.init({ dbPath: loadedConfig?.database?.path ?? '~/.repobench/db/repobench.db' });
```
with:
```ts
Database.init({ dbPath: resolveDatabasePath(loadedConfig?.database?.path) });
```

And add the import `resolveDatabasePath` to the existing import from `'../core/config.js'` (or `'../core/config'`).

**Canonical reference**: `src/cli/mine.ts:86` — this is the correct pattern already passing review.

| # | File | Lines to change | Import needed? |
|---|------|----------------|----------------|
| 1 | `src/infrastructure/persistence/database.ts` | Delete 122–125 (`initDatabase`) | — |
| 2 | `src/cli/index.ts` | 35, 64 | Add `resolveDatabasePath` to `'../core/config.js'` import |
| 3 | `src/cli/evaluate.ts` | 38 | Add `resolveDatabasePath` to `'../core/config.js'` import |
| 4 | `src/cli/run-all.ts` | 86 | Add `resolveDatabasePath` to `'../core/config'` import |
| 5 | `src/cli/report.ts` | 33 | Add `resolveDatabasePath` to `'../core/config.js'` import |
| 6 | `src/cli/export-failures.ts` | 24 | Add `resolveDatabasePath` to `'../core/config.js'` import |

### Verification
After all 6 fixes:
```bash
npm run typecheck && npm run lint && npm test
```
The string `'~/.repobench/db/repobench.db'` must NOT appear in any file under `src/cli/` or `src/infrastructure/persistence/database.ts` (only in `src/core/config.ts:27` as the Zod default and in `src/core/config.ts:99` as the `resolveDatabasePath` fallback).

## ESCALATION: ROUND 4 DETERMINATION

**Decision: Option (A) — Continue**

**Root cause of 3 failed rounds**: The existing ESCALATION DIRECTIVE (above) was appended to this spec file but **never executed against the actual code files**. Code verification confirms 0 of 6 required edits were applied. Only `src/cli/mine.ts` was correctly updated in a prior round.

**Current violation state:**

| # | Required Fix | File | Status |
|---|---|---|---|
| 1 | Delete `initDatabase()` (lines 122–125) | `src/infrastructure/persistence/database.ts` | **NOT DONE** |
| 2 | Replace fallback → `resolveDatabasePath()` (line 35, 64) | `src/cli/index.ts` | **NOT DONE** |
| 3 | Replace fallback → `resolveDatabasePath()` (line 38) | `src/cli/evaluate.ts` | **NOT DONE** |
| 4 | Replace fallback → `resolveDatabasePath()` (line 86) | `src/cli/run-all.ts` | **NOT DONE** |
| 5 | Replace fallback → `resolveDatabasePath()` (line 33) | `src/cli/report.ts` | **NOT DONE** |
| 6 | Replace fallback → `resolveDatabasePath()` (line 24) | `src/cli/export-failures.ts` | **NOT DONE** |

**Instruction**: Apply the 6 fixes documented in the ESCALATION DIRECTIVE above. Do not deviate. After all 6, run `npm run typecheck && npm run lint && npm test` to verify.

## Audit Feedback Round 5
The implementation for Task 2.6.2 is a **FAIL** due to widespread regressions in the test suite caused by the removal of `initDatabase()` and the refactoring of database initialization.

1. **Test Regressions**: The test suite (specifically `tests/integration/database-init-wiring.test.ts`, `tests/integration/report-cli.test.ts`, and many others) heavily relies on mocking `initDatabase()`. These tests now fail with `TypeError: undefined is not a spy or a call to a spy!` or `Error: The property "initDatabase" is not defined`.
2. **Action Required**: You must update all tests that reference `initDatabase()` to use `Database.init()` instead. This includes:
    - Updating mocks/spies in `tests/integration/database-init-wiring.test.ts`.
    - Updating any other test files that import or mock `initDatabase`.
    - Ensuring all tests properly verify the new canonical database initialization pattern.
3. **Status**: **NOT DONE**. The fix requires a comprehensive update to the test suite to match the new architecture. Do not mark this task as completed until all tests pass.

## Audit Feedback Round 6
The implementation for Task 2.6.2 remains a **FAIL**.

1. **Persistent Test Regressions**: The test suite continues to fail due to references to the deprecated `initDatabase()` function which was removed from the codebase.
2. **Missing Test Refactoring**: Files such as `tests/integration/database-init-wiring.test.ts` and `tests/integration/report-cli.test.ts` still attempt to call or mock `initDatabase()`.
3. **Action Required**: You must perform a comprehensive search across the entire `tests/` directory for any remaining calls to or imports of `initDatabase()` and refactor them to use the `Database.init()` pattern as established in the technical directive. Failure to do so prevents the project from building or testing successfully.
