# Task 4.FIX1.2: Rebuild better-sqlite3 Native Bindings & Validate Persistence Layer

## Priority: HIGH

## Problem
`npm test` fails with 10/12 test suite failures due to:
```
Error: Could not locate the bindings file. Tried:
 → D:\dev\RepoBench\node_modules\better-sqlite3\build\Debug\better_sqlite3.node
 → D:\dev\RepoBench\node_modules\better-sqlite3\build\Release\better_sqlite3.node
...
```

The `better-sqlite3` native addon was not rebuilt or is incompatible with the current Node.js version (v20.20.2 on win32/x64). This renders the entire persistence layer (CandidateRepository, ContainerRepository, SessionRepository) non-functional outside of mocked tests.

## Affected Test Files
- `tests/infrastructure/data-exchange.test.ts`
- `tests/integration/export-jsonl.test.ts`
- `tests/integration/import-jsonl.test.ts`
- `tests/core/repositories/candidate-repository.test.ts`
- `tests/infrastructure/sandbox-core.test.ts`
- `tests/infrastructure/sandbox-manager.test.ts`
- `tests/core/repositories/container-repository.test.ts`
- `tests/infrastructure/sandbox/sandbox-manager.test.ts`
- `tests/integration/cli-portability.test.ts`
- `tests/integration/mine.test.ts`

## Task
1. Run `npm rebuild better-sqlite3` to recompile native bindings for Node.js v20.20.2.
2. If rebuild fails, run `npx electron-rebuild -f -w better-sqlite3` or `npm install --build-from-source better-sqlite3`.
3. Run `npm test -- tests/core/repositories/ tests/infrastructure/sandbox-core.test.ts tests/infrastructure/sandbox-manager.test.ts tests/integration/export-jsonl.test.ts tests/integration/import-jsonl.test.ts tests/integration/mine.test.ts` to verify all previously-failing tests now pass.
4. If any tests still fail, diagnose and fix the specific test code issues (not the binding).

## DoD
- [ ] `better-sqlite3` native bindings build successfully
- [ ] All 10 previously-failing test files pass
- [ ] `npm test` has 0 failing test suites from persistence-layer causes
- [ ] If `npm rebuild` is insufficient, document the fix in MEMORY.md for future agents
