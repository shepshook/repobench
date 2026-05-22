# Task 5.FIX2.3: Epic Audit — Fix SessionOrchestrator Concrete Import Boundary Leak Round 2

**Epic:** 5 — Comparative Analysis & Reporting
**Feature:** 5.FIX2 — Global Epic Integration & Alignment Round 2
**Assigned to:** Agent
**Status:** Not Started

---

## Objective
Replace concrete `Sandbox` and `PtySession` imports in `SessionOrchestrator` (a core domain service) with their contract interfaces `ISandbox` and `IPtySession` from `contracts.ts`, restoring the dependency-inversion principle.

## Context
- `src/core/services/session-orchestrator.ts` lines 1-2 import concrete implementations from the infrastructure layer:
  ```ts
  import { Sandbox } from '../../infrastructure/sandbox';
  import { PtySession } from '../../infrastructure/pty-session';
  ```
- The interfaces `ISandbox` and `IPtySession` are already defined in `src/core/contracts.ts` and used correctly by all other core services (`Evaluator`, `JudgeService`, `BatchRunnerService`).
- The affected method signatures use the concrete types:
  - `createSession(config: AgentConfig, sandbox: Sandbox): Promise<IPtySession>` (line 17)
  - `executeSession(config: AgentConfig, sandbox: Sandbox, ...)` (line 52)
  - `validateAndRollback(sandbox: Sandbox, ...)` (line 80)
  - Internally calls `PtySession.create(sandbox, adapter, {}, promptHandler)` (line 29)
- ARCHITECTURE.md §3.1 states: *"Never write agent-specific logic in the SessionOrchestrator."* The architectural principle extends to infrastructure coupling — core services should depend on abstractions, not concretions.
- This is a **system-wide structural integrity issue**, not Epic 5-specific. It was discovered during the Epic 5 cross-module boundary audit and must be resolved before the epic can close.

## Instructions

### Step 1 — Verify ISandbox and IPtySession contracts are sufficient
Read `src/core/contracts.ts` and confirm that:
- `ISandbox` exposes `execute()`, `switchState()`, `createSnapshot()`, `restoreSnapshot()`, `destroy()`, `runCommand()`, `getProjectPath()`, `init()`
- `IPtySession` exposes `onData()`, `onTimeout()`, `write()`, `close()`, `waitForExit()`, `getScreenState()`, `create()`

The `SessionOrchestrator` currently uses:
- `sandbox.createSnapshot()` — exists on `ISandbox` ✅
- `sandbox.execute(command)` — exists on `ISandbox` ✅
- `sandbox.restoreSnapshot()` — exists on `ISandbox` ✅
- `PtySession.create(sandbox, adapter, {}, promptHandler)` — `IPtySession` may need a static `create()` or factory. Check whether `IPtySession` has a `create()` method or whether the architecture uses a different instantiation pattern.

If `IPtySession` does not expose a static `create()` factory, you must either:
- (Preferred) Add a `IPtySessionFactory` interface to `contracts.ts` and inject it via the constructor.
- (Acceptable) Keep `PtySession.create` but type the result as `IPtySession` and type the sandbox parameter as `ISandbox`.

### Step 2 — Replace concrete imports
In `src/core/services/session-orchestrator.ts`:
1. Remove lines 1-2 (`import { Sandbox } from ...` and `import { PtySession } from ...`).
2. Add `ISandbox` and `IPtySession` to the existing line 4 contract import.
3. Change `sandbox: Sandbox` to `sandbox: ISandbox` in all three methods (`createSession`, `executeSession`, `validateAndRollback`).
4. For `PtySession.create(...)`: either use a factory or cast the return to `IPtySession` if the contract allows.

### Step 3 — Update all call sites
Search for all callers of `sessionOrchestrator.createSession()` and `sessionOrchestrator.executeSession()` and ensure they pass `ISandbox` (they likely already do if they use the interface).

### Step 4 — Verify
- Run `npm run typecheck` — must pass with zero errors.
- Run `npm run lint` — must pass with zero errors.
- Run `npx vitest run tests/core/services/session-orchestrator.test.ts` — all tests must pass.
- Run `npm test` — full suite must pass.

## Acceptance Criteria
1. `session-orchestrator.ts` imports `ISandbox` and `IPtySession` from `../contracts` instead of concrete `Sandbox` and `PtySession` from `../../infrastructure/`.
2. All method signatures use `ISandbox` instead of `Sandbox`.
3. TypeScript typechecks cleanly.
4. All existing tests pass without modification.
5. ESLint passes cleanly.
6. No other core service imports concrete infrastructure classes (audit: `grep -r "from '../../infrastructure/" src/core/services/` returns zero results or only `session-orchestrator.ts` results that have been fixed).
