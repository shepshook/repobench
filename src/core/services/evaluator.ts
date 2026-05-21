import { 
  ISandbox, 
  SandboxConfig, 
  IRegressionTestRunner, 
  Candidate, 
  IEvaluator, 
  EvaluationResult, 
  TestResults 
} from '../contracts';
import { RegressionTestRunner } from './regression-test-runner';

export class Evaluator implements IEvaluator {
  constructor(
    private readonly sandbox: ISandbox,
    private readonly config: SandboxConfig,
    private readonly runner: IRegressionTestRunner = new RegressionTestRunner()
  ) {}

  async evaluate(candidate: Candidate): Promise<EvaluationResult> {
    const startTime = Date.now();
    let preResults: TestResults | null = null;
    let postResults: TestResults | null = null;

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

      const comparison = this.runner.compareResults(preResults, postResults);
      const regressionStatus = comparison.status === 'regressed' ? 'regressed' : 'clean';

      return {
        candidateId: candidate.id,
        regressionStatus,
        comparison,
        preTestResults: preResults,
        postTestResults: postResults,
        latency: Date.now() - startTime,
        message: comparison.summary,
      };
    } catch (e) {
      return {
        candidateId: candidate.id,
        regressionStatus: 'error',
        comparison: null,
        preTestResults: preResults,
        postTestResults: postResults,
        latency: Date.now() - startTime,
        message: e instanceof Error ? e.message : String(e),
      };
    }
  }
}
