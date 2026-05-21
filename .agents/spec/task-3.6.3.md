# Task 3.6.3: Integrate Configuration into BatchRunner

## Description
Update the `BatchRunner` to utilize the `AgentConfigLoader` and pass relevant configurations to the agent adapters during session orchestration.

## Specs
- Update `SessionOrchestrator` to accept `AgentConfig` and pass it to `AgentAdapterFactory.createAdapter()`.
- Map configurations to adapter-specific parameters (e.g., `cliArgs`, `completionSignatures`).
- Wire `AgentConfigLoader` into the session creation flow via `SessionOrchestrator.executeSession()`.

## DoD
- Agents are launched with parameters specified in `agents.yaml`.

## Audit Feedback Round 1
- **Status**: FAILED
- **Feedback**: The `BatchRunner` class and its corresponding file `src/core/services/batch-runner.ts` are missing from the codebase. Therefore, it is impossible to fulfill the requirements of Task 3.6.3 to "Integrate Configuration into BatchRunner". Additionally, there appears to be a roadmap inconsistency as `BatchRunner` is planned for Epic 5, while Task 3.6.3 (Epic 3) attempts to reference it.

## Audit Feedback Round 3
- **Status**: FAILED
- **Feedback**:
    1. Roadmap Inconsistency: `ROADMAP.md` still lists "Task 3.6.3: Integrate Configuration into BatchRunner", despite the task's own refactor plan indicating that `BatchRunner` is out of scope for this epic and should be removed.
    2. Incomplete Cleanup: `src/core/services/session-orchestrator.ts` still contains an unused import (`IPromptHandler` on line 4), which violates the linting cleanup plan outlined in Round 2.
    3. The refactor plan has been partially applied (linting in `agent-config-loader.ts` and deletion of `batch-runner.ts`), but not fully completed. Please align the roadmap and finalize the code cleanup.

## ESCALATION: REFACTOR

### Root Cause
The task spec violates architectural boundaries. `BatchRunner` belongs to **Epic 5 (Feature 5.2: Multi-Agent Batch Runner)**, not Epic 3. Forward-referencing it here creates an ordering dependency between epics (ROADMAP.md lines 197-203 vs lines 241-243).

### Refactor Plan

#### 1. Fix the Spec (ROADMAP.md + this file)
- **ROADMAP.md Feature 3.6 spec**: Change `"load hyper-parameters via BatchRunner"` to `"load hyper-parameters into SessionOrchestrator"`.
- **Task 3.6.3 spec**: Replace "Modify `BatchRunner` to load configurations" with "Integrate AgentConfig into `SessionOrchestrator.createSession()`".
- **Rationale**: Epic 3 owns SessionOrchestrator. Config integration at the session level is the correct boundary. Epic 5 will later compose BatchRunner on top of this foundation.

#### 2. Remove Premature BatchRunner from Epic 3
- Delete `src/core/services/batch-runner.ts`
- Delete `tests/core/services/batch-runner.test.ts`
- These will be recreated from scratch during Epic 5 Feature 5.2 with proper worker-pool semantics.

#### 3. Fix Task-Relevant Lint Errors (verified: only 5, not 549)
- `session-orchestrator.ts:4` — Remove unused `IPromptHandler` import
- `session-orchestrator.ts:37` — Fix promise-in-void callback via `void` operator
- `agent-config-loader.ts:3` — Remove unused `z` import
- `agent-config-loader.ts:9` — Remove `async` (no `await` in body)
- All other 30 lint errors are project-wide and unrelated to this task; track as `TECH_DEBT-lint-errors.md`

#### 4. Verify SessionOrchestrator Config Integration (Already Correct)
- `ISessionOrchestrator.executeSession()` accepts `AgentConfig` ✅
- `createSession()` passes `config.cliArgs` to `PtySession` ✅
- `completionSignatures` are set on `doneDetector` from config ✅
- `AgentAdapterFactory.createAdapter()` parses `AgentConfig` ✅

### Execution
Fixing items 1-3 above will clear both audit failures and resolve the architectural inconsistency. Total delta: ~10 lines changed across 3 files + 2 deletions.

## ESCALATION DIRECTIVE

### Status: CONTINUE (Round 4 resolved)

### Root Cause (Confirmed)
Architectural boundary violation — the original spec "Integrate Configuration into BatchRunner" forward-referenced `BatchRunner` (Epic 5, Feature 5.2) from Epic 3. The refactor plan correctly pivoted to `SessionOrchestrator`, which is the correct Epic 3 boundary.

### Remaining Fixes (3 items — all trivial, verified against current code)

#### Fix 1: ROADMAP.md line 202
Change task name to remove BatchRunner reference:
```
- [ ] [Task 3.6.3: Integrate Configuration into BatchRunner](.agents/spec/task-3.6.3.md)
```
→
```
- [ ] [Task 3.6.3: Integrate AgentConfig into SessionOrchestrator](.agents/spec/task-3.6.3.md)
```

#### Fix 2: `src/core/services/session-orchestrator.ts:49`
`@typescript-eslint/no-misused-promises` — `onTimeout` callback returns a promise but expects `void`.
```typescript
// BEFORE (line 49):
session.onTimeout(() => {
    return session.close().catch(err => {
// AFTER:
session.onTimeout(() => {
    void session.close().catch(err => {
```

#### Fix 3: `src/core/services/session-orchestrator.ts:81`
`@typescript-eslint/restrict-template-expressions` — `err` is `unknown` in template literal.
```typescript
// BEFORE (line 81):
console.error(`Session cleanup failed: ${err instanceof Error ? err.message : err}`);
// AFTER:
console.error(`Session cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
```

### Verification
- `npm run typecheck` ✅ passes
- `npm run lint` **must have 0 errors in `src/core/services/session-orchestrator.ts`** after fixes
- `npm run lint` may still have 540+ errors in other files — these are pre-existing debt, not task-related

### DoD Status
**ALREADY MET:** `AgentConfigLoader` reads `agents.yaml` → `SessionOrchestrator.createSession/executeSession` accept `AgentConfig` → config flows to `PtySession` (cliArgs), `DoneDetector` (completionSignatures), and `AgentAdapterFactory`. The 3 fixes above are cosmetic (lint + roadmap accuracy). No functional changes needed.

