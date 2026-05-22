# Task 5.2.FIX1: Fix BatchRunnerService Test Constructor Mock

## Context
- **File**: `tests/core/services/batch-runner.test.ts`
- **Root Cause**: The `BatchRunnerService` constructor was extended to accept `agentConfigs: AgentConfig[]` (6th param), `config: BatchConfig` (7th param), and `reporter?: IProgressReporter` (8th param), but the `beforeEach` mock in the test passes `{} as any` for `agentConfigs` and omits `config`. This causes `this.agentConfigs.find is not a function` at runtime when any worker task executes.
- **Error**: `BatchRunError: this.agentConfigs.find is not a function`

## Technical Directive
1. In `beforeEach` at line 69-76, update the `BatchRunnerService` constructor call to pass proper values for the new constructor parameters:
   - `agentConfigs`: pass an array like `[{ agentId: 'agent-1' } as AgentConfig, { agentId: 'agent-2' } as AgentConfig]`
   - `config`: pass `mockConfig` or a valid `BatchConfig` object (with `agentIds`, `concurrency`, etc.)
2. Ensure all 8 test cases still pass.

## Audit Feedback Round 1
- **Status**: FAIL
- **Reason**: The fix required in the `beforeEach` block of `tests/core/services/batch-runner.test.ts` was not implemented. The constructor call still uses `{}` for the required parameters instead of the specified `agentConfigs` and `config` objects.

## Audit Feedback Round 2
- **Status**: FAIL
- **Reason**: The constructor call in the `beforeEach` block (lines 70-77) of `tests/core/services/batch-runner.test.ts` still only passes 6 arguments, failing to provide the `agentConfigs` (6th), `config` (7th), and `reporter` (8th, optional) as required by the updated `BatchRunnerService` signature. The implementation still uses `{} as any` for what appears to be the `agentConfigs` parameter instead of the required array of `AgentConfig`.

## ESCALATION DIRECTIVE

The root cause is confirmed and well-understood. The fix is a single, narrow surgical change in **one file**: `tests/core/services/batch-runner.test.ts`. Two changes required, both in the `beforeEach` block at lines 41-78.

### Change 1 — Add `mockAgentConfigs` fixture (before `beforeEach` or inside it after `mockCandidateRepository`)

Add this fixture definition near the other mock data declarations (after line 68 in the existing `mockCandidateRepository` block, before the constructor call):

```typescript
const mockAgentConfigs: AgentConfig[] = [
  { agentId: 'agent-1', model: 'default', temperature: 0, systemPrompt: '', cliArgs: [] },
  { agentId: 'agent-2', model: 'default', temperature: 0, systemPrompt: '', cliArgs: [] },
  { agentId: 'agent-custom', model: 'default', temperature: 0, systemPrompt: '', cliArgs: [] },
];
```

**Why include `agent-custom`**: The test at line 222 ("should work with custom agent configurations") uses `agentIds: ['agent-custom']`. Without it in the mock array, `this.agentConfigs.find(a => a.agentId === 'agent-custom')` returns `undefined` and throws an error. This keeps all 8 tests passing.

### Change 2 — Update constructor call (lines 70-77)

Replace the current 6-argument call:

```typescript
    service = new BatchRunnerService(
      mockWorkerPool,
      mockSessionOrchestratorFactory,
      mockJudgeServiceFactory,
      mockSandboxFactory,
      mockCandidateRepository,
      {} as any // BatchConfig for constructor if needed, though runAll takes it
    );
```

With the correct 7-argument call:

```typescript
    service = new BatchRunnerService(
      mockWorkerPool,
      mockSessionOrchestratorFactory,
      mockJudgeServiceFactory,
      mockSandboxFactory,
      mockCandidateRepository,
      mockAgentConfigs,
      mockConfig,
    );
```

### Verification
After making both changes, run:
```bash
npx vitest run tests/core/services/batch-runner.test.ts
```
All 8 tests must pass. Then run the full lint suite:
```bash
npm run lint && npm run typecheck
```
No regressions.
