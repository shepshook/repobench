import { IWorkerPool, WorkerTask, WorkerResult } from '../../core/contracts';

export class WorkerPool implements IWorkerPool {
  private activeCount = 0;
  private isShuttingDown = false;
  private shutdownPromise: Promise<void> | null = null;
  private shutdownResolver: (() => void) | null = null;

  private queue: Array<{
    task: WorkerTask<unknown>;
    resolve: (result: WorkerResult<unknown>) => void;
  }> = [];

  constructor(private readonly maxConcurrency: number = 2) {}

  async exec<T>(tasks: WorkerTask<T>[]): Promise<WorkerResult<T>[]> {
    if (this.isShuttingDown) {
      return tasks.map(task => ({
        id: task.id,
        status: 'rejected',
        error: new Error('WorkerPool is shutting down'),
      }));
    }

    const resultsPromises = tasks.map(task => {
      return new Promise<WorkerResult<T>>((resolve) => {
        this.queue.push({
          task,
          resolve: resolve as (result: WorkerResult<unknown>) => void,
        });
      });
    });

    this.runWorkers();

    return Promise.all(resultsPromises);
  }

  private runWorkers() {
    while (this.queue.length > 0 && this.activeCount < this.maxConcurrency && !this.isShuttingDown) {
      const { task, resolve } = this.queue.shift()!;
      this.activeCount++;

      void (async () => {
        try {
          const value = await task.fn();
          resolve({ id: task.id, status: 'fulfilled', value });
        } catch (error) {
          resolve({
            id: task.id,
            status: 'rejected',
            error: error instanceof Error ? error : new Error(String(error)),
          });
        } finally {
          this.activeCount--;
          if (this.shutdownResolver && this.activeCount === 0) {
            this.shutdownResolver();
            this.shutdownResolver = null;
          }
          this.runWorkers();
        }
      })();
    }
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return this.shutdownPromise!;
    }

    this.isShuttingDown = true;

    while (this.queue.length > 0) {
      const { task, resolve } = this.queue.shift()!;
      resolve({
        id: task.id,
        status: 'rejected',
        error: new Error('WorkerPool is shutting down'),
      });
    }

    if (this.activeCount === 0) {
      return Promise.resolve();
    }

    this.shutdownPromise = new Promise<void>((resolve) => {
      this.shutdownResolver = resolve;
    });

    return this.shutdownPromise;
  }
}
