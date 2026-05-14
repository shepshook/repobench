import { IJudge, ISandbox, VerificationResult, EvalMetrics } from '../../types/contracts';
import { SandboxStateManager } from '../../sandbox/state-manager';

export class Judge implements IJudge {
  constructor(private sandbox: ISandbox) {}

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
      };
    } catch (e: unknown) {
      return {
        success: false,
        stdout: '',
        stderr: e instanceof Error ? e.message : String(e),
        duration: performance.now() - start,
      };
    }
  }

  async verify(preFixHash: string, postFixHash: string, testCommand: string): Promise<EvalMetrics> {
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

    return {
      success: targetBugFixed && regressions.length === 0,
      regressions,
      searchEfficiency: 0,
      latency: performance.now() - start,
      cost: 0,
      eScore: 0,
    };
  }

  private parsePassingTests(stdout: string): Set<string> {
    const passingTests = new Set<string>();
    const lines = stdout.split('\n');
    for (const line of lines) {
      // Match patterns like "TestFoo: passed", "PASSED: TestBar", "OK: TestBaz"
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
    throw new Error('Method not implemented.');
  }
}
