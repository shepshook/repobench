import {
  ISandbox,
  SandboxConfig,
  Candidate,
  IEvaluator,
  IJudgeService,
  EvaluationRunResult,
  IRunResultRepository,
  RunResult,
} from '../contracts';
import { randomUUID } from 'node:crypto';

export class JudgeService implements IJudgeService {
  constructor(
    private readonly sandbox: ISandbox,
    private readonly config: SandboxConfig,
    private readonly evaluator: IEvaluator,
    private readonly repository: IRunResultRepository,
  ) {}

  async runEvaluationPipeline(
    candidates: Candidate[],
    agentId: string = 'default-agent',
    costMap?: Map<string, number>,
    logPath?: string,
  ): Promise<EvaluationRunResult[]> {
    const results: EvaluationRunResult[] = [];
    for (const candidate of candidates) {
      const cost = costMap?.get(candidate.id);
      const result = await this.evaluator.evaluate(
        candidate,
        cost,
      );

      try {
        const runResult: RunResult = {
          runId: randomUUID(),
          agentId,
          candidateId: candidate.id,
          metrics: {
            success: result.regressionStatus === 'clean',
            cost: cost ?? 0,
            latency: result.latency,
            eScore: result.eScore,
          },
          timestamp: new Date(),
          logPath,
        };
        this.repository.save(runResult);
      } catch (error) {
        console.error(`Failed to persist run result for candidate ${candidate.id}:`, error);
      }

      results.push({ candidateId: candidate.id, result, cost });
    }
    return results;
  }
}
