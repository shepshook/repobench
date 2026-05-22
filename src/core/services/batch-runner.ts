import { 
  IBatchRunner, 
  BatchConfig, 
  BatchRunSummary, 
  AgentRunSummary, 
  IWorkerPool, 
  WorkerTask, 
  ICandidateRepository,
  ISessionOrchestrator,
  IJudgeService,
  ISandbox,
  Candidate,
  AgentConfig,
  IProgressReporter,
} from '../contracts';

export class BatchRunError extends Error {
  constructor(options: {
    agentId: string;
    candidateId: string;
    message: string;
    stdout?: string;
    stderr?: string;
  }) {
    super(options.message);
    this.name = 'BatchRunError';
    this.agentId = options.agentId;
    this.candidateId = options.candidateId;
    this.stdout = options.stdout;
    this.stderr = options.stderr;
  }

  agentId: string;
  candidateId: string;
  stdout?: string;
  stderr?: string;
}

interface AgentPairResult {
  success: boolean;
  eScore: number;
  cost: number;
  latency: number;
  agentId: string;
  candidateId: string;
}

export class BatchRunnerService implements IBatchRunner {
  private readonly agentConfigs: AgentConfig[];

  constructor(
    private readonly workerPool: IWorkerPool,
    private readonly sessionOrchestratorFactory: (agentId: string) => ISessionOrchestrator,
    private readonly judgeServiceFactory: (agentId: string) => IJudgeService,
    private readonly sandboxFactory: () => ISandbox,
    private readonly candidateRepository: ICandidateRepository,
    agentConfigs: AgentConfig[],
    private readonly config: BatchConfig,
    private readonly reporter?: IProgressReporter,
  ) {
    this.agentConfigs = agentConfigs;

  }

  async runAll(config: BatchConfig): Promise<BatchRunSummary> {
    const startTime = new Date();
    
    // 1. Resolve candidates
    let candidates: Candidate[];
    if (config.candidateIds && config.candidateIds.length > 0) {
      candidates = config.candidateIds
        .map(id => this.candidateRepository.getById(id))
        .filter((c): c is Candidate => !!c);
    } else {
      candidates = this.candidateRepository.getAll().filter(c => c.status === 'validated');
    }

    if (candidates.length === 0) {
      return this.createEmptySummary(startTime);
    }

    if (config.dryRun) {
      console.log('[Dry Run] BatchRunner: No tasks will be executed.');
      return this.createEmptySummary(startTime);
    }

    // 2. Build Cartesian product (candidate x agent)
    const tasks: WorkerTask<AgentPairResult>[] = [];
    for (const agentId of config.agentIds) {
      const agentConfig = this.agentConfigs.find(a => a.agentId === agentId);
      if (!agentConfig) {
        throw new Error(`Agent configuration not found for ${agentId}`);
      }

      for (const candidate of candidates) {
        const taskId = `${agentId}:${candidate.id}`;
        tasks.push({
          id: taskId,
          fn: async (): Promise<AgentPairResult> => {
            this.reporter?.onTaskStart(taskId, agentId, candidate.id);
            let sandbox: ISandbox | null = null;
            try {
              sandbox = this.sandboxFactory();
              await sandbox.init();

               const orchestrator = this.sessionOrchestratorFactory(agentId);
               const judge = this.judgeServiceFactory(agentId);

               const { cost } = await orchestrator.executeSession(agentConfig, sandbox, '');
               
               const costMap = new Map<string, number>();
              costMap.set(candidate.id, cost);

              const evalResults = await judge.runEvaluationPipeline([candidate], agentId, costMap);
              const runResult = evalResults[0];

              const result = {
                success: true,
                eScore: runResult.result.eScore,
                cost: runResult.cost || cost,
                latency: runResult.result.latency,
                agentId,
                candidateId: candidate.id
              };
              this.reporter?.onTaskComplete(taskId, { id: taskId, status: 'fulfilled', value: result });
              return result;
            } catch (error) {
              const err = error as Error & { stdout?: string; stderr?: string };
              const batchError = new BatchRunError({
                agentId,
                candidateId: candidate.id,
                message: err.message || 'Unknown error',
                stdout: err.stdout,
                stderr: err.stderr,
              });
              this.reporter?.onError(taskId, batchError);
              this.reporter?.onTaskComplete(taskId, { id: taskId, status: 'rejected', error: batchError });
              throw batchError;
            } finally {
              if (sandbox) {
                try {
                  await sandbox.destroy();
                } catch (destroyError) {
                  console.warn(`[BatchRunner] Failed to destroy sandbox for ${agentId}:${candidate.id}:`,
                    destroyError instanceof Error ? destroyError.message : String(destroyError));
                }
              }
            }
          }
        });
      }
    }

    // 3. Execute tasks
    const workerResults = await this.workerPool.exec(tasks);

    // 4. Aggregate results
    const agentStats = new Map<string, { totalEScore: number; totalCost: number; totalLatency: number; successfulRuns: number }>();
    let successfulRuns = 0;
    let failedRuns = 0;

    for (const res of workerResults) {
      if (res.status === 'rejected') {
        failedRuns++;
        continue;
      }

      const value = res.value as AgentPairResult;
      successfulRuns++;
      
      const agentId = value.agentId || res.id?.split(':')[0];
      if (!agentId) continue;

      const stats = agentStats.get(agentId) || { totalEScore: 0, totalCost: 0, totalLatency: 0, successfulRuns: 0 };
      stats.totalEScore += value.eScore;
      stats.totalCost += value.cost;
      stats.totalLatency += value.latency;
      stats.successfulRuns++;
      agentStats.set(agentId, stats);
    }

    const summaryResults = new Map<string, AgentRunSummary>();
    for (const agentId of config.agentIds) {
      const stats = agentStats.get(agentId);
      const agentTasks = workerResults.filter(r => r.id?.startsWith(`${agentId}:`));
      const totalRuns = agentTasks.length;

      if (!stats) {
        summaryResults.set(agentId, {
          agentId,
          totalRuns,
          successfulRuns: 0,
          avgEScore: 0,
          avgCost: 0,
          avgLatency: 0,
        });
      } else {
        summaryResults.set(agentId, {
          agentId,
          totalRuns,
          successfulRuns: stats.successfulRuns,
          avgEScore: Math.round((stats.totalEScore / stats.successfulRuns) * 1e10) / 1e10,
          avgCost: Math.round((stats.totalCost / stats.successfulRuns) * 1e10) / 1e10,
          avgLatency: Math.round((stats.totalLatency / stats.successfulRuns) * 1e10) / 1e10,
        });
      }
    }

    const summary = {
      totalRuns: tasks.length,
      successfulRuns,
      failedRuns,
      results: summaryResults,
      totalDuration: new Date().getTime() - startTime.getTime(),
      startedAt: startTime,
      completedAt: new Date(),
    };

    this.reporter?.onBatchComplete(summary);
    return summary;
  }

  cancel(): void {
    void this.workerPool.shutdown();
  }

  private createEmptySummary(startTime: Date): BatchRunSummary {
    return {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      results: new Map(),
      totalDuration: new Date().getTime() - startTime.getTime(),
      startedAt: startTime,
      completedAt: new Date(),
    };
  }
}
