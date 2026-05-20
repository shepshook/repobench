# Task 3.3.5: Implement Rollback Mechanism
- **Objective**: Implement a mechanism to revert file state if an auto-approved edit results in a build failure or regression.
- **Deliverable**: Rollback logic integrated into orchestrator/sandbox.

## Audit Feedback Round 1
- The `validateAndRollback` mechanism is implemented in `SessionOrchestrator`, but it is not utilized in the actual agent session orchestration loop. It is only called in `tests/services/session-rollback.test.ts`. 
- Integration into the main execution flow is required to fulfill the task objective.

## ESCALATION DIRECTIVE

### Root Cause
Both prior review attempts failed for the **same reason**: `validateAndRollback` exists as dead code. `SessionOrchestrator` has no orchestration loop (`run`/`executeSession`) that would actually call it. The tests can only invoke it via `(orchestrator as any)` because it is not part of any contract interface.

### Fix Instructions (3 files, precise edits)

#### 1. `src/core/contracts.ts` — Add `ISessionOrchestrator` interface
Add this after the `ISandbox` block (after line 137), before the agent-adapter import:

```typescript
export interface ISessionOrchestrator {
  createSession(config: AgentConfig, sandbox: ISandbox): Promise<IPtySession>;
  executeSession(config: AgentConfig, sandbox: ISandbox, buildCommand: string): Promise<{ success: boolean }>;
}
```

#### 2. `src/core/services/session-orchestrator.ts` — Add `executeSession`, wire rollback, remove dead param

Changes needed:
- **Remove unused `session` parameter** from `validateAndRollback` (signature → `(sandbox: Sandbox, command: string)`).
- **Add `executeSession` method** that:
  1. Calls `createSession(config, sandbox)`.
  2. Runs the agent (writes to PTY, waits for exit via `waitForExit` or similar).
  3. Reads `sandbox.config.buildCommand` (or the passed `buildCommand`) and calls `validateAndRollback(sandbox, buildCommand)`.
  4. Returns `{ success: boolean }` based on whether rollback was triggered.
  5. Calls `session.close()` in a `finally` block.
- Make the class `implements ISessionOrchestrator`.

#### 3. `tests/services/session-rollback.test.ts` — Test via `executeSession`, not bypass

Changes needed:
- Mock `PtySession.create` to return a session that has a `waitForExit` mock (resolves after a tick).
- Call `orchestrator.executeSession(config, mockSandbox, 'npm run build')` instead of `(orchestrator as any).validateAndRollback(...)`.
- Assert that `restoreSnapshot` is called on build failure and NOT called on build success.
- Remove the `if (!(orchestrator as any).validateAndRollback)` guard — it should be part of the interface now.

### Verification
```bash
npm run typecheck && npm run lint && npx vitest run tests/services/session-rollback.test.ts
```
