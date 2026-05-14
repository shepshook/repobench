import { IJudge, ISandbox, VerificationResult, EvalMetrics, ISession, SemanticEvaluation } from '../../types/contracts';
import { SandboxStateManager } from '../../sandbox/state-manager';
import { ISemanticJudge } from '../../types/contracts';
import { SemanticJudge } from './semantic-judge';
import { RepoBenchConfig } from '../config';

export class Judge implements IJudge {
  constructor(private sandbox: ISandbox, private config: RepoBenchConfig) {}

  private semanticJudge: ISemanticJudge = new SemanticJudge(this.config);

  /**
   * Verifies if a fix is correct by running the test command in the sandbox.
   */
  async verifyFix(sandbox: ISandbox, testCommand: string): Promise<VerificationResult> {
    const start = performance.now();
    try {
      const stdout = await sandbox.execute(testCommand);
      return {
        success: true,
        stdout,
        stderr: '',
        duration: performance.now() - start,
        efficiencyRatio: 0,
      };
    } catch (e: unknown) {
      return {
        success: false,
        stdout: '',
        stderr: e instanceof Error ? e.message : String(e),
        duration: performance.now() - start,
        efficiencyRatio: 0,
      };
    }
  }

  async verify(
    session: ISession, 
    preFixHash: string, 
    postFixHash: string, 
    testCommand: string, 
    bugDesc: string, 
    groundTruth: string, 
    agentFix: string
  ): Promise<EvalMetrics> {
    const stateManager = new SandboxStateManager();
    const start = performance.now();

    const candidate = { preFixHash, postFixHash };

    // 1. Pre-fix state
    const preResult = await stateManager.ensureState(this.sandbox, 'pre', candidate);
    if (preResult.needsRebuild) {
      await this.sandbox.setup();
    }
    const preStdout = await this.sandbox.execute(testCommand).catch(e => String(e));
    const passingPre = this.parsePassingTests(preStdout);

    // 2. Post-fix state
    const postResult = await stateManager.ensureState(this.sandbox, 'post', candidate);
    if (postResult.needsRebuild) {
      await this.sandbox.setup();
    }
    const postStdout = await this.sandbox.execute(testCommand).catch(e => String(e));
    const passingPost = this.parsePassingTests(postStdout);

    // 3. Identify regressions: PassingPre - PassingPost
    const regressions = Array.from(passingPre).filter(test => !passingPost.has(test));
    
    // 4. Identify if target bug is fixed: PassingPost - PassingPre is not empty
    const fixedBugs = Array.from(passingPost).filter(test => !passingPre.has(test));
    const targetBugFixed = fixedBugs.length > 0;

    // 5. Search Efficiency
    const filesOpened = session.getFilesOpened();
    const filesModified = session.getFilesModified();
    const efficiencyRatio = filesOpened / Math.max(1, filesModified);

    const latency = performance.now() - start;

    const metrics: EvalMetrics = {
      success: targetBugFixed && regressions.length === 0,
      regressions,
      searchEfficiency: efficiencyRatio,
      latency,
      cost: 0, 
      eScore: 0,
    };

    metrics.eScore = this.calculateScore(metrics);

    // 6. Semantic Evaluation
    metrics.semantic = await this.semanticJudge.evaluate(bugDesc, groundTruth, agentFix);

    return metrics;
  }

  private parsePassingTests(stdout: string): Set<string> {
    const passingTests = new Set<string>();
    const lines = stdout.split('\n');
    for (const line of lines) {
      const match = line.match(/([a-zA-Z0-9_-]+):\s*(?:passed|OK)|(?:PASSED|OK):\s*([a-zA-Z0-9_-]+)/i);
      if (match) {
        passingTests.add(match[1] || match[2]);
      }
    }
    return passingTests;
  }

  async runRegressionSuite(sandbox: ISandbox): Promise<EvalMetrics> {
    throw new Error('Method not implemented.');
  }

  calculateScore(metrics: Partial<EvalMetrics>): number {
    if (!metrics.success) return 0;

    const cost = Math.max(metrics.cost || 0, 0.000001);
    const latency = Math.max(metrics.latency || 0, 2);
    const efficiencyRatio = Math.max(metrics.searchEfficiency || 1, 1);
    const efficiencyMultiplier = 1 / efficiencyRatio;

    return (1 / (cost * Math.log(latency))) * efficiencyMultiplier;
  }
}
