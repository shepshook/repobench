import { ISandbox, IRegressionTestRunner, TestResults, ComparisonResult } from '../contracts';

export class RegressionTestRunner implements IRegressionTestRunner {
  async runTests(sandbox: ISandbox, command: string): Promise<TestResults> {
    const startTime = Date.now();

    let result: { stdout: string; stderr: string; exitCode: number };
    try {
      result = await sandbox.execute(command, { timeout: 300_000 });
    } catch (e) {
      throw new Error(
        `RegressionTestRunner.runTests failed: ${e instanceof Error ? e.message : String(e)}`,
        { cause: e },
      );
    }

    const duration = Date.now() - startTime;

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      duration,
      passed: result.exitCode === 0,
    };
  }

  compareResults(pre: TestResults, post: TestResults): ComparisonResult {
    const prePassed = pre.passed;
    const postPassed = post.passed;

    if (!prePassed && postPassed) {
      return {
        status: 'improved',
        diff: this.buildDiff(pre, post),
        summary: 'Tests were failing before the fix and are now passing.',
      };
    }

    if (prePassed && !postPassed) {
      return {
        status: 'regressed',
        diff: this.buildDiff(pre, post),
        summary: 'Tests that were passing before the fix are now failing.',
      };
    }

    return {
      status: 'unchanged',
      diff: this.buildDiff(pre, post),
      summary: 'Test results are unchanged.',
    };
  }

  private buildDiff(pre: TestResults, post: TestResults): string {
    return [
      `--- pre-fix\texitCode=${pre.exitCode}`,
      `+++ post-fix\texitCode=${post.exitCode}`,
      '',
      pre.stderr ? `pre-fix stderr:\n${pre.stderr}` : '',
      post.stderr ? `post-fix stderr:\n${post.stderr}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }
}
