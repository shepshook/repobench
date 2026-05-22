# Task 1.7.1: Register `mine` Command in Main CLI

**Epic:** 1 — Git-Based Benchmark Generation (The Miner)
**Feature:** 1.7 — CLI Integration & Config Readiness
**Status:** Not Started

---

## Objective
Integrate the standalone `mine` command into the main RepoBench CLI so users can run `repobench mine <repo-url>` instead of a separate script.

## Context
- `src/cli/mine.ts` exists as a standalone script with its own `Command` and `main()` entry point.
- `src/cli/index.ts` registers all other commands (`evaluate`, `run-all`, `report`, `export`, `import`, `export-failures`) via the main `program` instance.
- `mine.ts` is not imported or registered anywhere in `index.ts`.

## Instructions

### Step 1 — Export a registration function from `mine.ts`
Modify `src/cli/mine.ts`:
- Add a `registerMineCommand(program: Command): void` export function that adds the `mine` subcommand to the given `program` instance.
- The existing `main()` function and the `if (process.argv[1]...)` self-execution guard should be kept for backward compatibility.

```typescript
export function registerMineCommand(program: Command): void {
  program
    .command('mine')
    .description('Mine bug-fix candidates from git history')
    .option('-c, --config <path>', 'path to config file', 'repobench.yaml')
    .option('-r, --repo <path>', 'path to git repository')
    .action(async (options) => {
      // ... existing action logic from main() ...
    });
}
```

### Step 2 — Register in `src/cli/index.ts`
Add:
```typescript
import { registerMineCommand } from './mine.js';

// After registerRunAllCommand, registerReportCommand, etc:
registerMineCommand(program);
```

### Step 3 — Remove the `config` option's default value issue
The `mine` command's `-c, --config` option should not read `repobench.yaml` from the target repo directory by default when `-r` is provided. Since the `loadConfig` function in `mine.ts` already accepts a path, this is already correct — but verify that chdir happens before config load.

### Step 4 — Verify
- Run `npm run typecheck` — must pass.
- Run `npm run lint` — must pass.
- Manually test: `node src/cli/index.js mine --help` should show the mine command.
- The existing standalone `node src/cli/mine.ts` must still work.

## Acceptance Criteria
1. `repobench mine --help` displays the mine command with `-c` and `-r` options.
2. `repobench mine -r <path>` works identically to `node src/cli/mine.ts -r <path>`.
3. Typecheck and lint pass.
4. Existing standalone invocation is not broken.
