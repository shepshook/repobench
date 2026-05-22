# Task 5.2.4: Implement Progress Tracking, Error Aggregation & Summary Reporter

## Context
- Module: `src/core/services/batch-progress-reporter.ts` and `src/core/contracts.ts`
- Requirement: Feature 5.2 (Multi-Agent Batch Runner)
- Goal: Provide real-time progress feedback during batch execution and a terminal-rendered summary table on completion.

## Technical Directive
1. Add `IProgressReporter` interface to `src/core/contracts.ts`:
   - `onTaskStart(taskId: string, agentId: string, candidateId: string): void`
   - `onTaskComplete(taskId: string, result: WorkerResult<unknown>): void`
   - `onBatchComplete(summary: BatchRunSummary): void`
   - `onError(taskId: string, error: Error): void`
2. Create `src/core/services/batch-progress-reporter.ts`:
   - Implement `IProgressReporter` with terminal output.
   - `onTaskStart`: print `[agentId] Processing candidate candidateId...` to stdout.
   - `onTaskComplete`: print `[agentId] Done — success/failed` depending on result status.
   - `onBatchComplete`: print a formatted table with columns:
     - Agent ID, Runs, Passed, Failed, Avg E-Score, Avg Cost, Avg Latency
   - Use `console.table` or a manual column-aligned format for the table.
3. Update `BatchRunnerService` (from Task 5.2.3):
   - Accept an optional `IProgressReporter` in constructor.
   - Invoke reporter lifecycle methods before/after each worker task.
   - Invoke `onBatchComplete(summary)` after aggregation.
4. Create `src/core/services/batch-progress-reporter.test.ts`:
   - Verify `onTaskStart` / `onTaskComplete` produce expected output (capture stdout).
   - Verify `onBatchComplete` renders a table with correct summary data.
   - Verify `onError` formats error messages correctly.

## DoD
- `IProgressReporter` interface is defined in `src/core/contracts.ts`.
- `BatchProgressReporter` provides real-time per-task status and a final summary table.
- `BatchRunnerService` optionally accepts and invokes `IProgressReporter` at the correct lifecycle points.
- All unit tests pass (`npx vitest run tests/core/services/batch-progress-reporter.test.ts`).
- `npm run typecheck && npm run lint` pass.
