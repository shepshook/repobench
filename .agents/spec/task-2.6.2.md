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
