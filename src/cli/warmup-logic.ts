import { Config } from '../core/config.js';
import { SqliteCandidateRepository } from '../core/repositories/candidate-repo.js';
import { SandboxFactory } from '../sandbox/index.js';

async function limit<T, R>(concurrency: number, tasks: (() => Promise<R>)[], onProgress?: (index: number, total: number, message: string) => void): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];
  let index = 0;

  async function runTask(): Promise<void> {
    while (index < tasks.length) {
      const currentIdx = index++;
      const task = tasks[currentIdx];
      
      try {
        results[currentIdx] = await task();
      } catch (e) {
        results[currentIdx] = (e as any);
      }
    }
  }

  const pool = Array.from({ length: Math.min(concurrency, tasks.length) }, () => runTask());
  await Promise.all(pool);
  return results;
}

export async function warmupCandidates(): Promise<void> {
  const config = Config.load();
  const repo = new SqliteCandidateRepository();
  const candidates = await repo.findAll();

  if (candidates.length === 0) {
    console.log('No candidates found to warm up.');
    return;
  }

  console.log(`Warming up ${candidates.length} candidates...`);

  const tasks = candidates.map((candidate, index) => async () => {
    console.log(`Warming up [${index + 1}/${candidates.length}] Candidate: ${candidate.hash}...`);
    
    const sandbox = SandboxFactory.create(
      {
        commitHash: candidate.hash,
        repoPath: '.', // Use current dir as default for warmup
      },
      config,
      true // Force Docker
    );

    try {
      await sandbox.init();
    } catch (e) {
      console.error(`Failed to warm up candidate ${candidate.hash}:`, e);
    } finally {
      await sandbox.destroy();
    }
  });

  await limit(3, tasks);
  console.log('Warmup complete.');
}
