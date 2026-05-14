import { IJudge, ISandbox, VerificationResult, EvalMetrics } from '../../types/contracts';

export class Judge implements IJudge {
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

  async verify(preFixCwd: string, postFixCwd: string, testCommand: string): Promise<EvalMetrics> {
    throw new Error('Method not implemented.');
  }

  async runRegressionSuite(sandbox: ISandbox): Promise<EvalMetrics> {
    throw new Error('Method not implemented.');
  }

  calculateScore(metrics: Partial<EvalMetrics>): number {
    throw new Error('Method not implemented.');
  }
}
