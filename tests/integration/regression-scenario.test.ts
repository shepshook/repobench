import { describe, it, expect, vi } from 'vitest';
import { RegressionTestRunner } from '../../src/core/services/regression-test-runner';
import { createSandboxFixture } from '../infrastructure/fixtures';

describe('Regression Scenario Integration', () => {
  it('should detect a regression when pre-fix tests pass and post-fix tests fail', async () => {
    const runner = new RegressionTestRunner();
    const { sandbox } = createSandboxFixture();
    
    // Mock sandbox to track state
    let state = 'pre';
    vi.spyOn(sandbox, 'switchState').mockImplementation(async (s: string) => {
        state = s;
    });
    vi.spyOn(sandbox, 'execute').mockImplementation(async (cmd: string) => {
        if (state === 'pre') {
          return { stdout: 'passed', stderr: '', exitCode: 0 };
        } else {
          return { stdout: 'failed', stderr: 'regression!', exitCode: 1 };
        }
    });

    // 1. Run pre-fix
    await sandbox.switchState('pre');
    const preResults = await runner.runTests(sandbox, 'npm test');
    expect(preResults.passed).toBe(true);

    // 2. Switch to post-fix
    await sandbox.switchState('post');
    const postResults = await runner.runTests(sandbox, 'npm test');
    expect(postResults.passed).toBe(false);

    // 3. Compare
    const comparison = runner.compareResults(preResults, postResults);
    
    // The scenario is a regression
    expect(comparison.status).toBe('regressed');
  });
});
