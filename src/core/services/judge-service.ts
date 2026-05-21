import {
  ISandbox,
  SandboxConfig,
  Candidate,
  IEvaluator,
  IJudgeService,
  EvaluationRunResult,
} from '../contracts';

export class JudgeService implements IJudgeService {
  constructor(
    private readonly sandbox: ISandbox,
    private readonly config: SandboxConfig,
    private readonly evaluator: IEvaluator,
  ) {}

  async runEvaluationPipeline(candidates: Candidate[]): Promise<EvaluationRunResult[]> {
    const results: EvaluationRunResult[] = [];
    for (const candidate of candidates) {
      const result = await this.evaluator.evaluate(candidate);
      results.push({ candidateId: candidate.id, result });
    }
    return results;
  }
}
