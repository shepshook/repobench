# Task 5.2.2: Implement WorkerPool Service

## Context
- Module: `src/infrastructure/services/worker-pool.ts`
- Requirement: Feature 5.2 (Multi-Agent Batch Runner)
- Goal: Implement a generic `WorkerPool` that manages concurrent execution of async tasks with a configurable concurrency cap and graceful shutdown.

## Technical Directive
1. Create `src/infrastructure/services/worker-pool.ts` implementing `IWorkerPool`:
   - Constructor accepts `maxConcurrency: number` (default 2).
   - `exec<T>(tasks: WorkerTask<T>[]): Promise<WorkerResult<T>[]>`:
     - Execute up to `maxConcurrency` tasks in parallel using an internal semaphore.
     - Each task runs in its own `try/catch` — individual failures must not stop other tasks.
     - Return `WorkerResult<T>[]` with `status: 'fulfilled' | 'rejected'` per task.
     - Respect cancellation signal: if `shutdown()` is called, in-flight tasks finish but no new tasks start.
   - `getActiveCount(): number` returns current in-flight count.
   - `shutdown(): Promise<void>`:
     - Set cancellation flag, await in-flight tasks to drain, resolve when done.
     - Calling `shutdown()` multiple times is idempotent.
2. Create `src/infrastructure/services/worker-pool.test.ts`:
   - Verify max concurrency is respected (submit N > max tasks, confirm ≤ max run simultaneously).
   - Verify task-level error isolation: if task A throws, task B still resolves.
   - Verify `shutdown()` drains gracefully and no tasks start after shutdown.
   - Verify `getActiveCount()` returns correct values during execution.

## DoD
- `WorkerPool` correctly limits concurrent execution to `maxConcurrency`.
- Individual task failures do not propagate; results report `status: 'rejected'`.
- `shutdown()` blocks until in-flight tasks drain, then prevents new starts.
- All unit tests pass (`npx vitest run tests/infrastructure/services/worker-pool.test.ts`).
- `npm run typecheck && npm run lint` pass.
