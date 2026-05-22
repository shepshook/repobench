# Task 5.2.1: Define BatchRunner Contract, BatchConfig & WorkerPool Interface

## Context
- Module: `src/core/contracts.ts`
- Requirement: Feature 5.2 (Multi-Agent Batch Runner)
- Goal: Define the domain model, configuration schema, and service interfaces for batch-running multiple agents across candidates.

## Technical Directive
1. Add `BatchConfigSchema` to `src/core/contracts.ts`:
   - `agentIds: z.array(z.string()).min(1)` — the set of agents to run (maps to `agents.yaml` entries)
   - `candidateIds: z.array(z.string().uuid()).optional()` — specific candidates; omit to run against all unprocessed
   - `concurrency: z.number().int().min(1).max(10).default(2)` — max concurrent Docker container count
   - `timeoutPerRun: z.number().int().min(60_000).default(300_000)` — per-agent-per-candidate timeout (ms)
   - `dryRun: z.boolean().default(false)` — validate config without executing
2. Define `IBatchRunner` interface:
   - `runAll(config: BatchConfig): Promise<BatchRunSummary>`
   - `cancel(): void` — signal graceful shutdown of in-flight workers
3. Define `IWorkerPool` interface:
   - `exec<T>(tasks: WorkerTask<T>[]): Promise<WorkerResult<T>[]>`
   - `getActiveCount(): number`
   - `shutdown(): Promise<void>`
 4. Define `BatchRunSummary` type (transient aggregation; per-run persistence uses `IRunResultRepository`, not direct SQL):
    - `totalRuns: number`, `successfulRuns: number`, `failedRuns: number`
    - `results: Map<string, AgentRunSummary>` — keyed by agentId
    - `totalDuration: number`, `startedAt: Date`, `completedAt: Date`
5. Define `AgentRunSummary`:
   - `agentId: string`, `totalRuns: number`, `successfulRuns: number`
   - `avgEScore: number`, `avgCost: number`, `avgLatency: number`
6. Define `WorkerTask<T>` and `WorkerResult<T>` types:
   - `WorkerTask<T>`: `{ id: string; fn: () => Promise<T> }`
   - `WorkerResult<T>`: `{ id: string; status: 'fulfilled' | 'rejected'; value?: T; error?: Error }`

## Audit Feedback Round 1
The implementation is missing. `src/core/contracts.ts` does not contain any of the required interfaces (`IBatchRunner`, `IWorkerPool`) or types/schemas (`BatchConfigSchema`, `BatchRunSummary`, `AgentRunSummary`, `WorkerTask`, `WorkerResult`). Please implement them as per the technical directive.

## ESCALATION DIRECTIVE — Root Cause: Stale Audit Feedback

**Diagnosis:** This task is stuck in a false-negative loop. The required contracts WERE implemented
in `src/core/contracts.ts:479-531` (uncommitted working-tree change), and `tsc --noEmit` passes.
However, the spec file was never updated to reflect this — the `## Audit Feedback Round 1` section
still claims the implementation is missing, causing any subsequent reviewer to immediately reject.

**Verification (all match the Technical Directive):**
- ✅ `BatchConfigSchema` with `agentIds`, `candidateIds?`, `concurrency` (default 2), `timeoutPerRun` (default 300_000), `dryRun` (default false)
- ✅ `IBatchRunner` with `runAll(config): Promise<BatchRunSummary>` and `cancel(): void`
- ✅ `IWorkerPool` with `exec<T>(tasks): Promise<WorkerResult<T>[]>`, `getActiveCount(): number`, `shutdown(): Promise<void>`
- ✅ `BatchRunSummary` with `totalRuns`, `successfulRuns`, `failedRuns`, `results: Map<string, AgentRunSummary>`, `totalDuration`, `startedAt`, `completedAt`
- ✅ `AgentRunSummary` with `agentId`, `totalRuns`, `successfulRuns`, `avgEScore`, `avgCost`, `avgLatency`
- ✅ `WorkerTask<T>` with `id`, `fn: () => Promise<T>`
- ✅ `WorkerResult<T>` with `id`, `status: 'fulfilled' | 'rejected'`, `value?`, `error?`

**Fix Instructions:**
1. `git add src/core/contracts.ts .agents/spec/task-5.2.1.md .agents/ROADMAP.md` — stage all changes
2. `git commit -m "feat: complete Task 5.2.1 — BatchRunner contracts"` — commit
3. In `ROADMAP.md`, change `[ ]` to `[x]` for Task 5.2.1
4. Do NOT alter the existing contracts — they are correct as-is.
5. Proceed to Task 5.2.2 (WorkerPool implementation).