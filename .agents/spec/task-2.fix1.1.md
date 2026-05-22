# Task 2.FIX1.1: Register Benchmark CLI Command in Main CLI

**Epic:** 2 — Deterministic Sandbox Infrastructure (The Sandbox)  
**Feature:** 2.FIX1 — Global Epic Integration & Alignment Round 1  
**Status:** Pending

---

## Objective
Register the sandbox `benchmark` command into the main `repobench` CLI so that `repobench benchmark --help` works and the command is invocable from the unified entry point.

## Context
- `src/cli/benchmark.ts` defines a standalone `benchmark` command with its own `Command` instance and `program.parse(process.argv)`.
- This file is **never imported or registered** in `src/cli/index.ts`.
- The `package.json` has a separate `"benchmark": "npx tsx src/cli/benchmark.ts"` script as a workaround.
- Per ARCHITECTURE.md §7.2, all user-facing commands must be registered in `src/cli/index.ts`.

## Instructions

### Step 1 — Refactor benchmark.ts into a registration function
Edit `src/cli/benchmark.ts` to export a registration function (matching the pattern used by `registerMineCommand`, `registerEvaluateCommand`, etc.):

1. Remove the standalone `new Command()` and `program.parse(process.argv)` calls.
2. Export a function: `export function registerBenchmarkCommand(program: Command): void { ... }`
3. The function should register `program.command('benchmark')...` on the passed-in program.

### Step 2 — Register in index.ts
Edit `src/cli/index.ts`:
1. Add import: `import { registerBenchmarkCommand } from './benchmark.js';`
2. Add call: `registerBenchmarkCommand(program);` alongside the other `register*Command(program)` calls.

### Step 3 — Verify
- Run `npx tsx src/cli/index.ts --help` — `benchmark` must appear in the command list.
- Run `npx tsx src/cli/index.ts benchmark --help` — must display options `-p, --project <name>`.
- Run `npm run typecheck` — must pass.
- Run `npm run lint` — must pass.

## Acceptance Criteria
1. `repobench benchmark --help` displays options `-p, --project <name>` with description "Run sandbox initialization benchmark".
2. `repobench --help` lists `benchmark` among available commands.
3. No standalone `program.parse()` remains in `benchmark.ts`.
4. Typecheck and lint pass.
