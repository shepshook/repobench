# Task 5.2.5: CLI Integration (`repobench run-all`)

## Context
- Module: `src/cli/run-all.ts` and `src/cli/index.ts`
- Requirement: Feature 5.2 (Multi-Agent Batch Runner)
- Goal: Add the `run-all` CLI command that instantiates the full batch pipeline and outputs results.

## Technical Directive
1. Create `src/cli/run-all.ts`:
   - Export `registerRunAllCommand(program: Command): void`.
   - Register `repobench run-all` with options:
     - `-a, --agents <ids...>` (required) — comma-separated agent IDs
     - `-c, --concurrency <number>` (default 2) — max concurrent runs
     - `-p, --project <name>` (default `'default'`) — project name for sandbox config
     - `--candidate-ids <ids...>` (optional) — specific candidate UUIDs
     - `--timeout <ms>` (default 300000) — per-pair timeout in ms
     - `--dry-run` — validate config, print what would run, then exit
   - In the action handler:
     1. Parse and validate `BatchConfig` from options.
     2. If `--dry-run`, print the agent-candidate matrix and return.
     3. Initialize database (`initDatabase()`).
     4. Create shared instances:
        - `CandidateRepository`, `RunResultRepository`
        - `SandboxConfig`, `Sandbox` (one per worker, created in factory)
        - `Evaluator`, `JudgeService` (one per agent, created in factory)
        - `SessionOrchestrator` (one per agent, created in factory)
        - `WorkerPool` with configured concurrency
        - `BatchProgressReporter`
     5. Create `BatchRunnerService` and call `runAll(config)`.
     6. Print summary (handled by `BatchProgressReporter.onBatchComplete`).
     7. Exit with code 0 if all runs succeeded, 1 if any failed.
2. Update `src/cli/index.ts`:
   - Import and call `registerRunAllCommand(program)`.
3. Agent config loading:
   - Use `AgentConfigLoader` (from Feature 3.6) to load agent configurations from `agents.yaml` by the given agent IDs.
   - Pass resolved `AgentConfig[]` into the session orchestrator factory.

## DoD
- `repobench run-all --agents aider --concurrency 1 --dry-run` prints the planned run matrix and exits.
- `repobench run-all --agents aider claude-code --concurrency 2` executes the full pipeline.
- The batch runner correctly instantiates per-agent sandbox, session, and judge services.
- Exit code reflects overall success/failure status.
- `npm run typecheck && npm run lint` pass.

## Audit Feedback Round 1
- **Status**: FAIL
- **Findings**:
  1. `src/cli/run-all.ts` does not exist.
  2. `src/cli/index.ts` has not been updated to register the `run-all` command.
  3. The implementation of Task 5.2.5 is completely missing.
- **Action Required**: Please implement the `run-all` CLI command according to the technical directive in the spec.

## Audit Feedback Round 2
- **Status**: FAIL
- **Findings**:
   1. The `npm run lint` command failed with 3 errors in `src/cli/run-all.ts` related to unsafe `any` usage.
- **Action Required**: Resolve linting errors in `src/cli/run-all.ts` by properly typing the agent configuration filtering logic.

## ESCALATION DIRECTIVE (Applied 2026-05-22)
- **Ruling**: CONTINUE — 3 cosmetic lint errors; architecture, wiring, and tests are correct.
- **Root Cause**: `src/cli/run-all.ts:58` used `(a as any).agentId` and redundant runtime type-narrowing (`'agentId' in a`) in the `--dry-run` filter. `AgentConfigLoader.loadConfigs()` already returns `AgentConfig[]` (typed via Zod), so `as any` is unnecessary and breaks the lint rule.
- **Fix Applied**: Replaced the unsafe filter with typed `Array.isArray(allAgents) ? allAgents.filter(a => agentIds.includes(a.agentId)) : []` retaining the `Array.isArray` guard needed for auto-mocked test environments.
- **Verification**: `npm run typecheck && npm run lint && npx vitest run tests/integration/run-all-cli.test.ts` — all pass (7/7 tests, 0 lint errors, 0 type errors).

