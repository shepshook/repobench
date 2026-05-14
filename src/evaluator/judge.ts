import { execSync } from 'child_process';
import { IJudge, ISandbox, EvalMetrics } from '../../src/types/contracts';
import fs from 'fs';
import path from 'path';

export interface EvalResult {
  passed: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class Judge implements IJudge {
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
      }
    } catch (e: any) {
      return {
        passed: false,
        stdout: e.stdout ? e.stdout.toString() : '',
        stderr: e.stderr ? e.stderr.toString() : e.message,
        exitCode: e.status || 1,
      }
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

  async verify(preFixCwd: string, postFixCwd: string, testCommand: string): Promise<EvalMetrics> {
    throw new Error('Not implemented');
  }

  async runRegressionSuite(sandbox: ISandbox): Promise<EvalMetrics> {
    const regressionsDir = path.join(process.cwd(), 'tests', 'regressions');
    const regressions: string[] = [];
    let totalLatency = 0;
    let testCount = 0;
    
    if (!fs.existsSync(regressionsDir)) {
      return {
        success: true,
        regressions: [],
        searchEfficiency: 1,
        latency: 0,
        cost: 0,
        eScore: 1,
      }
    }

    const files = fs.readdirSync(regressionsDir);
    
    for (const file of files) {
      const filePath = path.join(regressionsDir, file);
      if (fs.lstatSync(filePath).isFile()) {
        testCount++;
        const start = Date.now();
        try {
          await sandbox.execute(filePath);
          totalLatency += (Date.now() - start);
        } catch (e) {
          totalLatency += (Date.now() - start);
          regressions.push(file);
        }
      }
    }

    const success = regressions.length === 0;
    const avgLatency = testCount > 0 ? totalLatency / testCount : 0;
    
    const metrics: EvalMetrics = {
      success,
      regressions,
      searchEfficiency: 1, // Dummy
      latency: avgLatency,
      cost: 0,             // Dummy
      eScore: success ? 1 : 0,
    }

    return metrics;
  }

  calculateScore(metrics: Partial<EvalMetrics>): number {
    let score = 0;

    if (metrics.success) score += 100;
    if (metrics.regressions && metrics.regressions.length === 0) score += 50;
    else if (metrics.regressions && metrics.regressions.length > 0) score -= 50;

    if (metrics.searchEfficiency !== undefined) {
      score += metrics.searchEfficiency * 50;
    }

    if (metrics.latency !== undefined) {
      score += Math.max(0, 50 - (metrics.latency / 1000));
    }

    return Math.max(0, score);
  }
}
