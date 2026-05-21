import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ISandbox, TestResults, ComparisonResult } from '../../../src/core/contracts';
import { RegressionTestRunner } from '../../../src/core/services/regression-test-runner';

describe('RegressionTestRunner', () => {
  let runner: RegressionTestRunner;
  let mockSandbox: ISandbox;

  beforeEach(() => {
    runner = new RegressionTestRunner();
    mockSandbox = {
      id: 'test-sandbox',
      config: { project: 'test-project' },
      init: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn(),
      switchState: vi.fn().mockResolvedValue(undefined),
      createSnapshot: vi.fn().mockResolvedValue(undefined),
      restoreSnapshot: vi.fn().mockResolvedValue(undefined),
      getFilesystemSnapshot: vi.fn().mockResolvedValue([]),
      getCacheStats: vi.fn().mockResolvedValue({ hits: 0, misses: 0 }),
      ping: vi.fn().mockResolvedValue(true),
    };
  });

  describe('runTests', () => {
    it('should execute the test command and return results', async () => {
      const command = 'npm test';
      const mockExecuteResult = {
        stdout: 'All tests passed',
        stderr: '',
        exitCode: 0,
      };
      (mockSandbox.execute as any).mockResolvedValue(mockExecuteResult);

      const result = await runner.runTests(mockSandbox, command);

      expect(mockSandbox.execute).toHaveBeenCalledWith(command, { timeout: 300000 });
      expect(result).toEqual({

        stdout: 'All tests passed',
        stderr: '',
        exitCode: 0,
        duration: expect.any(Number),
        passed: true,
      });
    });

    it('should return passed: false when exitCode is non-zero', async () => {
      const command = 'npm test';
      const mockExecuteResult = {
        stdout: 'Test failed',
        stderr: 'Error: expected 1 to be 2',
        exitCode: 1,
      };
      (mockSandbox.execute as any).mockResolvedValue(mockExecuteResult);

      const result = await runner.runTests(mockSandbox, command);

      expect(result.passed).toBe(false);
      expect(result.exitCode).toBe(1);
    });

    it('should handle empty stdout and stderr', async () => {
      const command = 'npm test';
      const mockExecuteResult = {
        stdout: '',
        stderr: '',
        exitCode: 0,
      };
      (mockSandbox.execute as any).mockResolvedValue(mockExecuteResult);

      const result = await runner.runTests(mockSandbox, command);

      expect(result.passed).toBe(true);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
    });

    it('should throw a descriptive error when sandbox.execute fails', async () => {
      const command = 'npm test';
      const error = new Error('Docker connection failed');
      (mockSandbox.execute as any).mockRejectedValue(error);

      await expect(runner.runTests(mockSandbox, command)).rejects.toThrow(/Docker connection failed/);
    });
  });

  describe('compareResults', () => {
    it('should return improved when pre fails and post passes', () => {
      const pre: TestResults = {
        stdout: 'fail',
        stderr: 'err',
        exitCode: 1,
        duration: 100,
        passed: false,
      };
      const post: TestResults = {
        stdout: 'pass',
        stderr: '',
        exitCode: 0,
        duration: 100,
        passed: true,
      };

      const result = runner.compareResults(pre, post);
      expect(result.status).toBe('improved');
      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe('string');
      expect(result.diff).toBeDefined();
      expect(typeof result.diff).toBe('string');
    });

    it('should return regressed when pre passes and post fails', () => {
      const pre: TestResults = {
        stdout: 'pass',
        stderr: '',
        exitCode: 0,
        duration: 100,
        passed: true,
      };
      const post: TestResults = {
        stdout: 'fail',
        stderr: 'err',
        exitCode: 1,
        duration: 100,
        passed: false,
      };

      const result = runner.compareResults(pre, post);
      expect(result.status).toBe('regressed');
      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe('string');
      expect(result.diff).toBeDefined();
      expect(typeof result.diff).toBe('string');
    });

    it('should return unchanged when both pass', () => {
      const pre: TestResults = {
        stdout: 'pass',
        stderr: '',
        exitCode: 0,
        duration: 100,
        passed: true,
      };
      const post: TestResults = {
        stdout: 'pass',
        stderr: '',
        exitCode: 0,
        duration: 100,
        passed: true,
      };

      const result = runner.compareResults(pre, post);
      expect(result.status).toBe('unchanged');
      expect(result.summary).toBeDefined();
      expect(result.diff).toBeDefined();
    });

    it('should return unchanged when both fail', () => {
      const pre: TestResults = {
        stdout: 'fail',
        stderr: 'err',
        exitCode: 1,
        duration: 100,
        passed: false,
      };
      const post: TestResults = {
        stdout: 'fail',
        stderr: 'err',
        exitCode: 1,
        duration: 100,
        passed: false,
      };

      const result = runner.compareResults(pre, post);
      expect(result.status).toBe('unchanged');
      expect(result.summary).toBeDefined();
      expect(result.diff).toBeDefined();
    });
  });
});
