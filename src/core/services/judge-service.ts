import {
  ISandbox,
  SandboxConfig,
  Candidate,
  IEvaluator,
  IJudgeService,
  EvaluationRunResult,
  IRunResultRepository,
  RunResult,
  IFailureArtifactExporter,
} from '../contracts';
import { randomUUID } from 'node:crypto';

export class JudgeService implements IJudgeService {
  constructor(
    private readonly sandbox: ISandbox,
    private readonly config: SandboxConfig,
    private readonly evaluator: IEvaluator,
    private readonly repository?: IRunResultRepository,
    private readonly failureArtifactExporter?: IFailureArtifactExporter,
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
      try {
        this.repository?.save(runResult);
      } catch (error) {
        console.error(`Failed to persist run result for candidate ${candidate.id}:`, error);
      }

      if (result.regressionStatus === 'regressed' || result.regressionStatus === 'error') {
        if (this.failureArtifactExporter) {
          try {
            await this.failureArtifactExporter.exportForRun(runResult.runId);
          } catch (e) {
            console.error(`Failed to export artifacts for run ${runResult.runId}:`, e);
          }
        }
      }

      results.push({ candidateId: candidate.id, result, cost });
    }
    return results;
  }
}
