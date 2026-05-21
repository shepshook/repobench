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

  async runEvaluationPipeline(candidates: Candidate[], costMap?: Map<string, number>): Promise<EvaluationRunResult[]> {
    const results: EvaluationRunResult[] = [];
    for (const candidate of candidates) {
      const cost = costMap?.get(candidate.id);
      const result = await this.evaluator.evaluate(
        candidate,
        ...(cost !== undefined ? [cost] : [])
      );
      results.push({ candidateId: candidate.id, result, cost });
    }
    return results;
  }
}
