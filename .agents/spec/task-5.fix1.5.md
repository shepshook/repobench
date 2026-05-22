# Task 5.FIX1.5: Replace RunResultRepository Static Instance Anti-Pattern with DI

**Epic:** 5 — Comparative Analysis & Reporting
**Feature:** 5.FIX1 — Global Epic Integration & Alignment Round 1
**Assigned to:** Agent
**Status:** Not Started

---

## Objective
Remove the static `instances[]` array and `getLastCreated()` method from `RunResultRepository` and replace with proper constructor-based dependency injection.

## Context
- `src/core/repositories/run-result-repository.ts` lines 4–16 maintain a process-wide static `instances: RunResultRepository[]` array that tracks every instance created. `getLastCreated()` is used by `src/cli/report.ts` line 26.
- This violates DI principles and makes the system non-deterministic across CLI invocations.
- The `report` CLI currently calls `RunResultRepository.getLastCreated()` — this only works because another CLI command was assumed to have created an instance earlier in the same process. When `report` runs standalone, it falls back to `new RunResultRepository()` anyway.
- The `CandidateRepository` already follows proper DI — it uses the global `db` import. `RunResultRepository` should do the same. Since `initDatabase()` is called at the start of every CLI command, `RunResultRepository` can just use `new RunResultRepository()` directly.

## Instructions

### Step 1 — Remove static instance tracking from `RunResultRepository`
In `src/core/repositories/run-result-repository.ts`, **delete** lines 4–16 (the `instances` array, the constructor push, and the `getLastCreated` static method):
```ts
const instances: RunResultRepository[] = [];

export class RunResultRepository implements IRunResultRepository {
  constructor() {
    instances.push(this);
  }

  static getLastCreated(): RunResultRepository {
    const latest = instances.at(-1);
    if (latest) return latest;
    const repo = new RunResultRepository();
    return repo;
  }
```

Replace with just:
```ts
export class RunResultRepository implements IRunResultRepository {
```

### Step 2 — Update `report.ts` CLI to use constructor directly
In `src/cli/report.ts` line 26, change:
```ts
        const repository = RunResultRepository.getLastCreated();
```
to:
```ts
        const repository = new RunResultRepository();
```

### Step 3 — Verify
- Run `npm run typecheck` — must pass with zero errors.
- Run `npm run lint` — must pass with zero errors.
- Run `npx vitest run tests/core/repositories/run-result-repository.test.ts tests/integration/report-cli.test.ts tests/integration/judge-persistence.test.ts tests/integration/export-failures-cli.test.ts` — all tests must pass.

## Acceptance Criteria
1. `RunResultRepository` no longer has static `instances` array or `getLastCreated()` method.
2. `report.ts` uses `new RunResultRepository()` instead of `getLastCreated()`.
3. TypeScript typechecks cleanly, lint passes.
4. All existing repository and report CLI tests pass.
