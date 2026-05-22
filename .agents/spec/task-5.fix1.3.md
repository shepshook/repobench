# Task 5.FIX1.3: Remove Sandbox Destroy Error Swallow in BatchRunnerService

**Epic:** 5 — Comparative Analysis & Reporting
**Feature:** 5.FIX1 — Global Epic Integration & Alignment Round 1
**Assigned to:** Agent
**Status:** Not Started

---

## Objective
Replace the completely silenced sandbox teardown error in `BatchRunnerService` with a logged warning so that orphaned container/volume leaks are discoverable.

## Context
- `src/core/services/batch-runner.ts` line 141: `void sandbox.destroy().catch(() => {});`
- This completely ignores sandbox destruction failures. If `destroy()` fails, Docker containers or volumes may accumulate as orphans, violating Feature 2.2 DoD ("Zero orphaned containers post-run").
- ARCHITECTURE.md §4.3: "Do not swallow errors."
- Since this is in a `finally` block within an async task function, throwing would be awkward. The correct approach is to log via `console.warn` so the operator can investigate.

## Instructions

### Step 1 — Replace error swallowing with logged warning
In `src/core/services/batch-runner.ts`, line 141, change:
```ts
                void sandbox.destroy().catch(() => {});
```
to:
```ts
                try {
                  await sandbox.destroy();
                } catch (destroyError) {
                  console.warn(`[BatchRunner] Failed to destroy sandbox for ${agentId}:${candidate.id}:`,
                    destroyError instanceof Error ? destroyError.message : String(destroyError));
                }
```

### Step 2 — Verify
- Run `npm run typecheck` — must pass with zero errors.
- Run `npm run lint` — must pass with zero errors.
- Run `npx vitest run tests/core/services/batch-runner.test.ts tests/core/services/batch-runner-di.test.ts tests/integration/run-all-cli.test.ts` — all tests must pass.

## Acceptance Criteria
1. `sandbox.destroy()` failure is logged via `console.warn` with context (agent ID, candidate ID, error message).
2. No error is thrown from the `finally` block (the task still completes/rejects based on the original error).
3. TypeScript typechecks cleanly, lint passes.
4. All existing batch-runner tests pass.
