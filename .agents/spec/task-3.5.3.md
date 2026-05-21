1: # Task 3.5.3: Integrate CostParser into SessionOrchestrator
2: 
3: ## Goal
4: Integrate the `CostParser` into the session orchestration lifecycle to automatically capture costs during and after agent runs.
5: 
6: ## Tasks
7: - Update `SessionOrchestrator` to initialize and use `CostParser`.
8: - Ensure cost metrics are persisted alongside session logs.
9: - Update log reporting to include cost summaries.
10: 
11: ## DoD
12: - `SessionOrchestrator` correctly triggers parsing after session end.
13: - Costs are correctly associated with the run ID.
14: 
15: ## Audit Feedback Round 1
16: The implementation of Task 3.5.3 fails to meet the following requirements:
17: - **Persistence and Logging**: `SessionOrchestrator` does not persist cost metrics alongside session logs, nor does it update log reporting to include cost summaries.
18: - **DoD (Association)**: The DoD requires that "Costs are correctly associated with the run ID", but `SessionOrchestrator.executeSession` lacks the `runId` parameter and does not perform this association.
19: 
20: The current implementation only performs the parsing, but fails to integrate this into the required persistence and reporting workflows as specified in the Tasks and DoD.

## Audit Feedback Round 2
- **Log Reporting**: `executeSession` successfully persists cost metrics to the `sessionRepository`, but fails to generate or output a cost summary log, as required by the Task 3.5.3 goal ('Update log reporting to include cost summaries').

## ESCALATION DIRECTIVE

### Root Cause
Two prior fix attempts each addressed only one of the three task requirements. Fix #1 added parsing but omitted persistence and `runId` association. Fix #2 added persistence but omitted cost summary logging. The task is stuck because neither fix applied all requirements holistically.

### Remaining Gap
The third task requirement — **"Update log reporting to include cost summaries"** — is unmet. After cost metrics are parsed (and optionally persisted), `executeSession` must output a human-readable cost summary.

### Precise Fix Instructions

1. **In `src/core/services/session-orchestrator.ts`**, inside the `if (this.costParser)` block (lines 63-70), add a `console.log` call **after** parsing (and optional persistence) to emit a cost summary. Use the `runId` if available. Follow the existing pattern (`console.error` is already used on line 79 for cleanup failure).

   **What to add** (after line 70):
   ```typescript
   console.log(`[Cost Summary]${runId ? ` Run: ${runId},` : ''} Total Tokens: ${metrics.totalTokens}, Cost: ${metrics.cost} ${metrics.currency}`);
   ```

2. **In `tests/services/session-orchestrator.test.ts`**, add a test to `describe('SessionOrchestrator Cost Integration')` that asserts `console.log` is called with a cost summary string after `executeSession` completes. Spy on `console.log` in `beforeEach` and assert the format matches `[Cost Summary]`. Group by functional domain per ARCHITECTURE.md §7.2.

3. **Update the DoD** by appending a line:
   ```
   - `executeSession` outputs a cost summary log after parsing metrics.
   ```

### Verification
Run the tests:
```bash
npm test -- tests/services/session-orchestrator.test.ts
```
The existing cost integration tests must still pass, and the new test must assert `console.log` was called with the cost summary format.
