import { 
  ISandbox, 
  SandboxConfig, 
  IRegressionTestRunner, 
  Candidate, 
  IEvaluator, 
  EvaluationResult, 
  TestResults,
  ISearchEfficiencyTracker,
  EfficiencyMetrics,
  IScorer,
  ComparisonResult,
  ISemanticJudge,
  SemanticScore
} from '../contracts';
import { RegressionTestRunner } from './regression-test-runner';
import { SearchEfficiencyTracker } from './search-efficiency-tracker';
import { EScoreService } from './e-score-service';

export class Evaluator implements IEvaluator {
  constructor(
    private readonly sandbox: ISandbox,
    private readonly config: SandboxConfig,
    private readonly runner: IRegressionTestRunner = new RegressionTestRunner(),
    private readonly scorer: IScorer = new EScoreService(),
    private readonly semanticJudge?: ISemanticJudge
  ) {}

  async evaluate(candidate: Candidate, cost?: number): Promise<EvaluationResult>;
  async evaluate(candidate: Candidate, tracker: ISearchEfficiencyTracker, cost?: number): Promise<EvaluationResult>;
  async evaluate(candidate: Candidate, trackerOrCost?: ISearchEfficiencyTracker | number, cost?: number): Promise<EvaluationResult> {
    const startTime = Date.now();
    let tracker: ISearchEfficiencyTracker;
    let actualCost: number = 0;

    if (typeof trackerOrCost === 'number') {
        tracker = new SearchEfficiencyTracker();
        actualCost = trackerOrCost;
    } else {
        tracker = trackerOrCost || new SearchEfficiencyTracker();
        actualCost = cost || 1;
    }
    const t = tracker;
    let preResults: TestResults | null = null;
    let postResults: TestResults | null = null;
    let comparison: ComparisonResult | null = null;
    let regressionStatus: 'clean' | 'regressed' | 'error' = 'error';

    try {
      if (!candidate.preFixHash) {
        throw new Error('Candidate missing preFixHash');
      }
      await this.sandbox.switchState(candidate.preFixHash);
      preResults = await this.runner.runTests(this.sandbox, this.config.testCommand || '');

      if (!candidate.postFixHash) {
        throw new Error('Candidate missing postFixHash');
      }
      await this.sandbox.switchState(candidate.postFixHash);
      postResults = await this.runner.runTests(this.sandbox, this.config.testCommand || '');

      if (!preResults || !postResults) {
        throw new Error('Failed to obtain both pre and post test results');
      }

      const accessTracker = this.sandbox.getFileAccessTracker();
      accessTracker.getAccessedFiles().forEach(f => t.trackAccess(f));
      accessTracker.getModifiedFiles().forEach(f => t.trackModification(f));
      t.updateTimeTaken(Math.max(1, Date.now() - startTime));

      comparison = this.runner.compareResults(preResults, postResults);
      regressionStatus = comparison.status === 'regressed' ? 'regressed' : 'clean';

      const efficiency = t.getMetrics();
      const eScore: number = this.scorer.calculateEScore({
          success: regressionStatus === 'clean' ? 1 : 0,
          cost: actualCost,
          latency: Math.max(2, Date.now() - startTime),
          efficiencyMultiplier: efficiency.efficiencyRatio ?? 1
      });

      let semanticScore: SemanticScore | null = null;
      if (this.semanticJudge && comparison) {
        try {
          semanticScore = await this.semanticJudge.judge(comparison.diff);
        } catch (e) {
          // Log error but don't fail the evaluation
          console.error(`Semantic judge failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      return {
        candidateId: candidate.id,
        regressionStatus,
        comparison,
        preTestResults: preResults,
        postTestResults: postResults,
        latency: Math.max(1, Date.now() - startTime),
        message: comparison.summary,
        efficiency,
        eScore: eScore,
        semanticScore
      };
    } catch (e) {
      return {
        candidateId: candidate.id,
        regressionStatus: 'error',
        comparison: null,
        preTestResults: preResults,
        postTestResults: postResults,
        latency: Math.max(1, Date.now() - startTime),
        message: e instanceof Error ? e.message : String(e),
        efficiency: t.getMetrics(),
        eScore: 0,
        semanticScore: null
      };
    }
  }
}
