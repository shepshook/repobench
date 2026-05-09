import { execSync } from 'child_process';

export interface EvalResult {
  passed: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class Judge {
  /**
   * Runs a test command in a given directory and returns the result.
   */
  static runTest(cwd: string, testCommand: string): EvalResult {
    console.log(`Running test: ${testCommand} in ${cwd}...`);
    try {
      const stdout = execSync(testCommand, { 
        cwd, 
        encoding: 'utf8',
        stdio: 'pipe' 
      });
      return {
        passed: true,
        stdout,
        stderr: '',
        exitCode: 0,
      };
    } catch (e: any) {
      return {
        passed: false,
        stdout: e.stdout ? e.stdout.toString() : '',
        stderr: e.stderr ? e.stderr.toString() : e.message,
        exitCode: e.status || 1,
      };
    }
  }

  /**
   * Verifies if a fix is correct by checking if the pre-fix state fails
   * and the post-fix state passes.
   */
  static verifyFix(preFixCwd: string, postFixCwd: string, testCommand: string): boolean {
    const preResult = this.runTest(preFixCwd, testCommand);
    const postResult = this.runTest(postFixCwd, testCommand);

    return !preResult.passed && postResult.passed;
  }
}
