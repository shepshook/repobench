import { describe, it, expect, vi } from 'vitest';
import { Judge } from '../../../src/core/judge/judge';
import { ISandbox } from '../../../src/types/contracts';

describe('Judge', () => {
  const judge = new Judge();

  describe('verifyFix', () => {
    it('should return success: true when sandbox.execute succeeds', async () => {
      const mockSandbox: ISandbox = {
        init: vi.fn(),
        setup: vi.fn(),
        verify: vi.fn(),
        ping: vi.fn(),
        execute: vi.fn().mockResolvedValue('test output'),
        switchToState: vi.fn(),
        destroy: vi.fn(),
        getWorkingDir: vi.fn(),
      };

      const result = await judge.verifyFix(mockSandbox, 'npm test');

      expect(result.success).toBe(true);
      expect(result.stdout).toBe('test output');
      expect(result.stderr).toBe('');
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(mockSandbox.execute).toHaveBeenCalledWith('npm test');
    });

    it('should return success: false when sandbox.execute throws an error', async () => {
      const errorMessage = 'test failed';
      const mockSandbox: ISandbox = {
        init: vi.fn(),
        setup: vi.fn(),
        verify: vi.fn(),
        ping: vi.fn(),
        execute: vi.fn().mockRejectedValue(new Error(errorMessage)),
        switchToState: vi.fn(),
        destroy: vi.fn(),
        getWorkingDir: vi.fn(),
      };

      const result = await judge.verifyFix(mockSandbox, 'npm test');

      expect(result.success).toBe(false);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe(errorMessage);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(mockSandbox.execute).toHaveBeenCalledWith('npm test');
    });

    it('should return success: true when sandbox.execute returns an empty string', async () => {
      const mockSandbox: ISandbox = {
        init: vi.fn(),
        setup: vi.fn(),
        verify: vi.fn(),
        ping: vi.fn(),
        execute: vi.fn().mockResolvedValue(''),
        switchToState: vi.fn(),
        destroy: vi.fn(),
        getWorkingDir: vi.fn(),
      };

      const result = await judge.verifyFix(mockSandbox, 'npm test');

      expect(result.success).toBe(true);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
    });

    it('should handle non-Error throws in sandbox.execute', async () => {
      const errorMsg = 'string error';
      const mockSandbox: ISandbox = {
        init: vi.fn(),
        setup: vi.fn(),
        verify: vi.fn(),
        ping: vi.fn(),
        execute: vi.fn().mockRejectedValue(errorMsg),
        switchToState: vi.fn(),
        destroy: vi.fn(),
        getWorkingDir: vi.fn(),
      };

      const result = await judge.verifyFix(mockSandbox, 'npm test');

      expect(result.success).toBe(false);
      expect(result.stderr).toBe(errorMsg);
    });
  });
});
