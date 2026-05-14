import { describe, it, expect } from 'vitest';
import { AiderAdapter } from '../../../../src/core/session/adapters/aider';
import { ClaudeCodeAdapter } from '../../../../src/core/session/adapters/claude-code';

describe('Done Detection', () => {
  describe('AiderAdapter', () => {
    const adapter = new AiderAdapter();

    it('should return true for Aider done signatures', () => {
      expect(adapter.isDone('I have finished the task')).toBe(true);
      expect(adapter.isDone('All tests passed')).toBe(true);
      expect(adapter.isDone('Task complete')).toBe(true);
      expect(adapter.isDone('Task complete')).toBe(true); // partial match if regex allows
    });

    it('should return false for non-matching input', () => {
      expect(adapter.isDone('I am still working on it')).toBe(false);
      expect(adapter.isDone('Hello world')).toBe(false);
    });
  });

  describe('ClaudeCodeAdapter', () => {
    const adapter = new ClaudeCodeAdapter();

    it('should return true for Claude Code done signatures', () => {
      expect(adapter.isDone("I've completed the task")).toBe(true);
      expect(adapter.isDone('The task is now finished')).toBe(true);
      expect(adapter.isDone('Everything is set up and working')).toBe(true);
    });

    it('should return false for non-matching input', () => {
      expect(adapter.isDone('I am still working on it')).toBe(false);
      expect(adapter.isDone('Hello world')).toBe(false);
    });
  });
});
