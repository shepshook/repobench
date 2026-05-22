# Task 5.FIX2.1: Epic Audit — Inject DB via Constructor into RunResultRepository Round 2

**Epic:** 5 — Comparative Analysis & Reporting
**Feature:** 5.FIX2 — Global Epic Integration & Alignment Round 2
**Assigned to:** Agent
**Status:** Not Started

---

## Objective
Refactor `RunResultRepository` to receive its database dependency via constructor injection instead of importing a module-level global singleton. This satisfies the DoD stated in Task 5.FIX1.5 that was not actually met.

## Context
- `src/core/repositories/run-result-repository.ts` line 1 imports `{ db }` from `../../infrastructure/persistence/database` — a module-level singleton.
- The class has a zero-arg constructor (`constructor() {}` is implicit) and builds prepared statements at class-instantiation time using the global `db.prepare(...)`.
- The `database.ts` module exports `getRawDb()` as well as the wrapped `db` object and `reinitDatabase()`.
- Current tests (`run-result-repository.test.ts`, `judge-persistence.test.ts`, `report-cli.test.ts`) work around this by calling `reinitDatabase(tempPath)` before constructing `new RunResultRepository()` — a side-effect anti-pattern.
- The `CandidateRepository` in `src/core/repositories/candidate-repository.ts` may follow the same pattern for reference.

## Instructions

### Step 1 — Define a DB connection type in `contracts.ts`
In `src/core/contracts.ts`, define a minimal interface for the database operations the repository needs:

```ts
export interface IDatabase {
  prepare<T>(sql: string): {
    get(...params: unknown[]): T | undefined;
    all(...params: unknown[]): T[];
    run(...params: unknown[]): { changes: number; lastInsertRowid: number };
  };
  run(sql: string, ...params: unknown[]): { changes: number; lastInsertRowid: number };
}
```

### Step 2 — Add constructor parameter to `RunResultRepository`
In `src/core/repositories/run-result-repository.ts`:
1. Import `IDatabase` from `contracts` (keep `IRunResultRepository`, `RunResult`).
2. Remove the `import { db } from ...` line.
3. Add a constructor that receives `database: IDatabase`:
   ```ts
   export class RunResultRepository implements IRunResultRepository {
     private saveStmt;
     private getByIdStmt;
     private getAllStmt;
     private getByAgentIdStmt;
     private getByCandidateIdStmt;

     constructor(database: IDatabase) {
       this.saveStmt = database.prepare(`...`);
       this.getByIdStmt = database.prepare(`...`);
       // ... etc
     }
     // ... methods unchanged
   }
   ```
4. Use the constructor parameter for all `prepare()` calls instead of the global `db`.

### Step 3 — Update all call sites
Every place that constructs `new RunResultRepository()` must now pass the database:

- `src/cli/run-all.ts` — pass `db` (imported from infrastructure/persistence/database)
- `src/cli/report.ts` — pass `db`
- `src/cli/export-failures.ts` — pass `db`
- `src/core/services/judge-service.ts` — if it constructs the repository directly
- Any test files constructing `RunResultRepository` — pass `db`

### Step 4 — Update tests
- `tests/core/repositories/run-result-repository.test.ts` — after calling `reinitDatabase(tempPath)`, construct with `new RunResultRepository(db)`. Add a test asserting that the constructor parameter is used (inject a mock and verify `prepare()` was called).
- `tests/integration/judge-persistence.test.ts` — same pattern.
- `tests/integration/report-cli.test.ts` — same pattern.

### Step 5 — Verify
- Run `npm run typecheck` — must pass with zero errors.
- Run `npm run lint` — must pass with zero errors.
- Run `npm test` — all tests must pass. Pay special attention to:
  - `tests/core/repositories/run-result-repository.test.ts`
  - `tests/integration/judge-persistence.test.ts`
  - `tests/integration/report-cli.test.ts`
  - `tests/integration/run-all-cli.test.ts`
  - `tests/integration/export-failures-cli.test.ts`

## Acceptance Criteria
1. `RunResultRepository` constructor accepts `IDatabase` parameter.
2. No `import { db }` from `../../infrastructure/persistence/database` in `run-result-repository.ts`.
3. All existing `new RunResultRepository()` call sites pass `db` argument.
4. At least one test verifies the constructor parameter is used (inject a mock `IDatabase`).
5. Full test suite passes.
6. TypeScript typechecks cleanly.
7. ESLint passes cleanly.
