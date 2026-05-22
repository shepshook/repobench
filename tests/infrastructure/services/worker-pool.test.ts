import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkerPool } from '../../../src/infrastructure/services/worker-pool';
import type { WorkerTask } from '../../../src/core/contracts';

describe('WorkerPool', () => {
  let workerPool: WorkerPool;
  const MAX_CONCURRENCY = 2;

  beforeEach(() => {
    workerPool = new WorkerPool(MAX_CONCURRENCY);
  });

  const createDelayedTask = (id: string, duration: number, shouldFail = false): WorkerTask<string> => ({
    id,
    fn: async () => {
      await new Promise((resolve) => setTimeout(resolve, duration));
      if (shouldFail) throw new Error(`Task ${id} failed`);
      return `Task ${id} completed`;
    },
  });

  it('should respect max concurrency', async () => {
    const tasks = [
      createDelayedTask('1', 100),
      createDelayedTask('2', 100),
      createDelayedTask('3', 100),
    ];

    const execPromise = workerPool.exec(tasks);
    
    // Small delay to allow tasks to start
    await new Promise((resolve) => setTimeout(resolve, 10));
    
    expect(workerPool.getActiveCount()).toBe(MAX_CONCURRENCY);
    
    await execPromise;
    expect(workerPool.getActiveCount()).toBe(0);
  });

  it('should isolate task errors', async () => {
    const tasks = [
      createDelayedTask('1', 50, true),
      createDelayedTask('2', 50, false),
    ];

    const results = await workerPool.exec(tasks);

    expect(results).toEqual([
      { id: '1', status: 'rejected', error: expect.any(Error) },
      { id: '2', status: 'fulfilled', value: 'Task 2 completed' },
    ]);
  });

  it('should drain in-flight tasks on shutdown', async () => {
    const tasks = [
      createDelayedTask('1', 100),
      createDelayedTask('2', 100),
    ];

    const execPromise = workerPool.exec(tasks);
    
    // Give it a moment to start
    await new Promise((resolve) => setTimeout(resolve, 10));
    
    const shutdownPromise = workerPool.shutdown();
    
    // Shutdown should not immediately resolve if tasks are in-flight
    let shutdownResolved = false;
    shutdownPromise.then(() => { shutdownResolved = true; });
    
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(shutdownResolved).toBe(false);
    
    await shutdownPromise;
    expect(shutdownResolved).toBe(true);
    await execPromise;
  });

  it('should not start new tasks after shutdown', async () => {
    await workerPool.shutdown();
    
    const tasks = [createDelayedTask('1', 50)];
    const results = await workerPool.exec(tasks);
    
    // Depending on implementation, it might reject immediately or just not run.
    // The spec says "no new tasks start".
    // If they don't start, they should probably be marked as rejected or the pool should throw.
    // Given WorkerResult, we expect them to be 'rejected' if they couldn't start due to shutdown.
    expect(results[0].status).toBe('rejected');
  });

  it('should be idempotent on shutdown', async () => {
    await workerPool.shutdown();
    await expect(workerPool.shutdown()).resolves.not.toThrow();
  });

  it('should track active count correctly', async () => {
    const tasks = [
      createDelayedTask('1', 100),
      createDelayedTask('2', 100),
      createDelayedTask('3', 100),
    ];

    const execPromise = workerPool.exec(tasks);
    
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(workerPool.getActiveCount()).toBe(2);
    
    await execPromise;
    expect(workerPool.getActiveCount()).toBe(0);
  });
});
