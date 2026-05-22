# Task 5.FIX1.4: Wire FailureArtifactExporter into Run-All CLI & Unify Sandbox Lifecycle

**Epic:** 5 — Comparative Analysis & Reporting
**Feature:** 5.FIX1 — Global Epic Integration & Alignment Round 1
**Assigned to:** Agent
**Status:** Not Started

---

## Objective
Fix two structural issues in `src/cli/run-all.ts`:
1. The `judgeServiceFactory` does not pass a `FailureArtifactExporter`, so batch runs never auto-export failure artifacts (unlike the standalone `evaluate` CLI which does).
2. The `judgeServiceFactory` creates a **separate** `new Sandbox(sandboxConfig)` that is never `.init()`-ed, while the batch runner task function independently creates its own sandbox via `sandboxFactory()`. This creates two sandbox instances with mismatched lifecycle.

## Context
- `src/cli/evaluate.ts` line 59–60 correctly creates a `FailureArtifactExporter` and passes it to `JudgeService` as the 5th argument. The `run-all` CLI does not.
- `src/cli/run-all.ts` lines 89–96: `judgeServiceFactory` creates `new Sandbox(sandboxConfig)` and wraps it in `JudgeService`. Meanwhile, `batch-runner.ts` line 103 calls `this.sandboxFactory()` to create its own sandbox that IS `.init()`-ed. The `JudgeService` sandbox is never initialized.
- The `judgeServiceFactory` signature is `(agentId: string) => IJudgeService` but both factories in `run-all.ts` ignore the parameter.

## Instructions

### Step 1 — Remove standalone sandbox from `judgeServiceFactory`
Since the `BatchRunnerService` already manages sandbox lifecycle per-task (creates via `sandboxFactory`, init, then destroy), the `judgeServiceFactory` should receive the **same sandbox instance** and not create a second one.

Change the `judgeServiceFactory` signature from `(agentId: string) => IJudgeService` to `(sandbox: ISandbox) => IJudgeService` — but wait, changing the `IBatchRunner` contract signature would be a wider change. Instead, restructure `batch-runner.ts` to pass the sandbox through.

**Better approach**: Update `BatchRunnerService` constructor to accept a `judgeServiceFactory: (sandbox: ISandbox) => IJudgeService` and update the caller in `run-all.ts` accordingly.

In `src/core/contracts.ts`, find the `IBatchRunner` interface — it doesn't have constructor params since it's an interface. The `BatchRunnerService` constructor already accepts a `judgeServiceFactory: (agentId: string) => IJudgeService`. Change this to:

In `src/core/services/batch-runner.ts`, line 53–54:
```ts
    private readonly sessionOrchestratorFactory: (agentId: string) => ISessionOrchestrator,
    private readonly judgeServiceFactory: (sandbox: ISandbox) => IJudgeService,
```

In the task function (line 107), change:
```ts
               const judge = this.judgeServiceFactory(agentId);
```
to:
```ts
               const judge = this.judgeServiceFactory(sandbox);
```

### Step 2 — Update `run-all.ts` to wire `FailureArtifactExporter`
Change the `judgeServiceFactory` lambda in `src/cli/run-all.ts` (lines 89–97) from:
```ts
          () => {
            const sandbox = new Sandbox(sandboxConfig);
            return new JudgeService(
              sandbox, 
              sandboxConfig, 
              new Evaluator(sandbox, sandboxConfig), 
              runResultRepo
            );
          },
```
to:
```ts
          (sandbox) => {
            const failureArtifactExporter = new FailureArtifactExporter(runResultRepo, candidateRepo, sandbox);
            return new JudgeService(
              sandbox,
              sandboxConfig,
              new Evaluator(sandbox, sandboxConfig),
              runResultRepo,
              failureArtifactExporter
            );
          },
```

Also add the import for `FailureArtifactExporter` at the top of the file:
```ts
import { FailureArtifactExporter } from '../infrastructure/failure-artifact-exporter';
```

### Step 3 — Update factory signature in `BatchRunnerService`
In `src/core/services/batch-runner.ts`:
- Line 54: Change factory type from `(agentId: string) => IJudgeService` to `(sandbox: ISandbox) => IJudgeService`
- Line 107: Change `this.judgeServiceFactory(agentId)` to `this.judgeServiceFactory(sandbox)`
- Line 106: Move `orchestrator` creation before `judge` since they're independent, or just keep existing order.

### Step 4 — Verify
- Run `npm run typecheck` — must pass with zero errors.
- Run `npm run lint` — must pass with zero errors.
- Run `npx vitest run tests/core/services/batch-runner.test.ts tests/core/services/batch-runner-di.test.ts tests/integration/run-all-cli.test.ts tests/integration/export-failures-cli.test.ts` — all tests must pass.

## Acceptance Criteria
1. `run-all` CLI instantiates `FailureArtifactExporter` and passes it to `JudgeService`.
2. The sandbox received by `JudgeService` is the same instance that was initialized by `BatchRunnerService` (no uninitialized sandbox).
3. `judgeServiceFactory` receives `(sandbox: ISandbox)` instead of `(agentId: string)`.
4. TypeScript typechecks cleanly, lint passes.
5. All existing batch-runner and run-all-cli tests pass.
