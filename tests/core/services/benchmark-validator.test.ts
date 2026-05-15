import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BenchmarkValidator } from '../../../src/core/services/benchmark-validator';
import { ISandbox, Candidate } from '../../../src/core/contracts';

describe('BenchmarkValidator', () => {
  let sandbox: ISandbox;
  let config: any;
  let validator: BenchmarkValidator;

  beforeEach(() => {
    sandbox = {
      id: 'test-sandbox',
      init: vi.fn(),
      destroy: vi.fn(),
      execute: vi.fn(),
      switchState: vi.fn(),
      getFilesystemSnapshot: vi.fn(),
      ping: vi.fn(),
    };

    config = {
      mining: {
        testCommand: 'npm test',
      },
    };

    validator = new BenchmarkValidator(sandbox, config);
  });

  const mockCandidate: Candidate = {
    id: 'candidate-1',
    hash: 'abc1234',
    message: 'fix bug',
    files: ['src/index.ts'],
    status: 'pending',
    created_at: new Date(),
  };

  it('should return isValid: true when pre-fix fails and post-fix passes', async () => {
    sandbox.execute
      .mockResolvedValueOnce({ stdout: 'failed', stderr: 'error', exitCode: 1 }) // Pre-fix
      .mockResolvedValueOnce({ stdout: 'passed', stderr: '', exitCode: 0 });    // Post-fix

    const result = await validator.validate(mockCandidate);

    expect(result.isValid).toBe(true);
    expect(result.preFixStatus).toBe('fail');
    expect(result.postFixStatus).toBe('pass');
    expect(sandbox.switchState).toHaveBeenCalledWith('abc1234^');
    expect(sandbox.switchState).toHaveBeenCalledWith('abc1234');
  });

  it('should return isValid: false when already passing', async () => {
    sandbox.execute
      .mockResolvedValueOnce({ stdout: 'passed', stderr: '', exitCode: 0 }) // Pre-fix
      .mockResolvedValueOnce({ stdout: 'passed', stderr: '', exitCode: 0 });    // Post-fix

    const result = await validator.validate(mockCandidate);

    expect(result.isValid).toBe(false);
    expect(result.preFixStatus).toBe('pass');
    expect(result.postFixStatus).toBe('pass');
  });

  it('should return isValid: false when still failing', async () => {
    sandbox.execute
      .mockResolvedValueOnce({ stdout: 'failed', stderr: 'error', exitCode: 1 }) // Pre-fix
      .mockResolvedValueOnce({ stdout: 'failed', stderr: 'error', exitCode: 1 });    // Post-fix

    const result = await validator.validate(mockCandidate);

    expect(result.isValid).toBe(false);
    expect(result.preFixStatus).toBe('fail');
    expect(result.postFixStatus).toBe('fail');
  });

  it('should return isValid: false when it causes a regression', async () => {
    sandbox.execute
      .mockResolvedValueOnce({ stdout: 'passed', stderr: '', exitCode: 0 }) // Pre-fix
      .mockResolvedValueOnce({ stdout: 'failed', stderr: 'error', exitCode: 1 });    // Post-fix

    const result = await validator.validate(mockCandidate);

    expect(result.isValid).toBe(false);
    expect(result.preFixStatus).toBe('pass');
    expect(result.postFixStatus).toBe('fail');
  });

  it('should return isValid: false and status: error when sandbox throws an error', async () => {
    sandbox.execute.mockRejectedValue(new Error('Sandbox crash'));

    const result = await validator.validate(mockCandidate);

    expect(result.isValid).toBe(false);
    expect(result.preFixStatus).toBe('error');
    expect(result.postFixStatus).toBe('error');
  });

  it('should return isValid: false and status: error when switchState fails', async () => {
    sandbox.switchState.mockRejectedValue(new Error('Git error'));

    const result = await validator.validate(mockCandidate);

    expect(result.isValid).toBe(false);
    expect(result.preFixStatus).toBe('error');
  });
});
