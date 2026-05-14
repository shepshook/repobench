import { describe, it, expect, vi } from 'vitest';
import { Judge } from '../../../src/core/judge/judge';
import { ISandbox, ISession } from '../../../src/types/contracts';
import { LLMClient } from '../../../src/core/llm/client';

vi.mock('../../../src/core/llm/client');

describe('Judge', () => {
  const mockConfig: any = {
    llm: {
      api_key: 'test',
      endpoint: 'http://test',
      model: 'gpt-4',
      temperature: 0,
    },
  };
  const mockSandbox: ISandbox = {
    init: vi.fn(),
    setup: vi.fn(),
    verify: vi.fn(),
    ping: vi.fn(),
    execute: vi.fn(),
    switchToState: vi.fn(),
    destroy: vi.fn(),
    getWorkingDir: vi.fn(),
  };
  const judge = new Judge(mockSandbox, mockConfig);

  describe('verifyFix', () => {
    it('should return success: true when sandbox.execute succeeds', async () => {
      vi.mocked(mockSandbox.execute).mockResolvedValue('test output');
      const result = await judge.verifyFix(mockSandbox, 'npm test');
      expect(result.success).toBe(true);
      expect(result.stdout).toBe('test output');
    });

    it('should return success: false when sandbox.execute throws an error', async () => {
      const errorMessage = 'test failed';
      vi.mocked(mockSandbox.execute).mockRejectedValue(new Error(errorMessage));
      const result = await judge.verifyFix(mockSandbox, 'npm test');
      expect(result.success).toBe(false);
      expect(result.stderr).toBe(errorMessage);
    });

    it('should return success: true when sandbox.execute returns an empty string', async () => {
      vi.mocked(mockSandbox.execute).mockResolvedValue('');
      const result = await judge.verifyFix(mockSandbox, 'npm test');
      expect(result.success).toBe(true);
    });

    it('should handle non-Error throws in sandbox.execute', async () => {
      const errorMsg = 'string error';
      vi.mocked(mockSandbox.execute).mockRejectedValue(errorMsg);
      const result = await judge.verifyFix(mockSandbox, 'npm test');
      expect(result.success).toBe(false);
      expect(result.stderr).toBe(errorMsg);
    });
  });

  describe('verify', () => {
    const mockSession: ISession = {
      start: vi.fn(),
      write: vi.fn(),
      readUntil: vi.fn(),
      end: vi.fn(),
      getFilesOpened: vi.fn().mockReturnValue(0),
      getFilesModified: vi.fn().mockReturnValue(0),
    };

    it('should detect regressions when a test passes pre-fix but fails post-fix', async () => {
      vi.mocked(LLMClient.prototype.chat).mockResolvedValue(JSON.stringify({ correctness: 5, maintainability: 5, idiomaticity: 5, justification: 'ok' }));
      vi.mocked(mockSandbox.execute)
        .mockResolvedValueOnce('TestA: passed\nTestB: passed') // Pre-fix
        .mockResolvedValueOnce('TestA: passed\nTestC: passed'); // Post-fix

      const result = await judge.verify(mockSession, 'hash1', 'hash2', 'npm test', 'desc', 'truth', 'fix');

      expect(result.success).toBe(false);
      expect(result.regressions).toContain('TestB');
    });

    it('should return success: true when target bug is fixed and no regressions occur', async () => {
      vi.mocked(LLMClient.prototype.chat).mockResolvedValue(JSON.stringify({ correctness: 5, maintainability: 5, idiomaticity: 5, justification: 'ok' }));
      vi.mocked(mockSandbox.execute)
        .mockResolvedValueOnce('TestA: passed') // Pre-fix
        .mockResolvedValueOnce('TestA: passed\nTestB: passed'); // Post-fix

      const result = await judge.verify(mockSession, 'hash1', 'hash2', 'npm test', 'desc', 'truth', 'fix');

      expect(result.success).toBe(true);
      expect(result.regressions).toEqual([]);
    });

    it('should return success: false if no target bug is fixed even if no regressions occur', async () => {
      vi.mocked(LLMClient.prototype.chat).mockResolvedValue(JSON.stringify({ correctness: 5, maintainability: 5, idiomaticity: 5, justification: 'ok' }));
      vi.mocked(mockSandbox.execute)
        .mockResolvedValueOnce('TestA: passed') // Pre-fix
        .mockResolvedValueOnce('TestA: passed'); // Post-fix

      const result = await judge.verify(mockSession, 'hash1', 'hash2', 'npm test', 'desc', 'truth', 'fix');

      expect(result.success).toBe(false);
    });

    it('should calculate the efficiency ratio correctly', async () => {
      vi.mocked(LLMClient.prototype.chat).mockResolvedValue(JSON.stringify({ correctness: 5, maintainability: 5, idiomaticity: 5, justification: 'ok' }));
      vi.mocked(mockSandbox.execute).mockResolvedValue('TestA: passed');
      vi.mocked(mockSession.getFilesOpened).mockReturnValue(10);
      vi.mocked(mockSession.getFilesModified).mockReturnValue(2);

      const result = await judge.verify(mockSession, 'hash1', 'hash2', 'npm test', 'desc', 'truth', 'fix');

      expect(result.searchEfficiency).toBe(5);
    });

    it('should handle zero modified files for efficiency ratio', async () => {
      vi.mocked(LLMClient.prototype.chat).mockResolvedValue(JSON.stringify({ correctness: 5, maintainability: 5, idiomaticity: 5, justification: 'ok' }));
      vi.mocked(mockSandbox.execute).mockResolvedValue('TestA: passed');
      vi.mocked(mockSession.getFilesOpened).mockReturnValue(5);
      vi.mocked(mockSession.getFilesModified).mockReturnValue(0);

      const result = await judge.verify(mockSession, 'hash1', 'hash2', 'npm test', 'desc', 'truth', 'fix');

      expect(result.searchEfficiency).toBe(5);
    });

    it('should include semantic evaluation in the result', async () => {
      const semanticResponse = JSON.stringify({ correctness: 4, maintainability: 3, idiomaticity: 2, justification: 'Meh' });
      vi.mocked(LLMClient.prototype.chat).mockResolvedValue(semanticResponse);
      vi.mocked(mockSandbox.execute).mockResolvedValue('TestA: passed');

      const result = await judge.verify(mockSession, 'hash1', 'hash2', 'npm test', 'desc', 'truth', 'fix');

      expect(result.semantic).toEqual({ correctness: 4, maintainability: 3, idiomaticity: 2, justification: 'Meh' });
    });
  });
});
