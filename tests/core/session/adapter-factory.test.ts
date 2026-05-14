import { describe, it, expect } from 'vitest';
import { AdapterFactory } from '../../../src/core/session/adapter-factory';
import { AiderAdapter } from '../../../src/core/session/adapters/aider';
import { ClaudeCodeAdapter } from '../../../src/core/session/adapters/claude-code';

describe('AdapterFactory', () => {
  it('should return an AiderAdapter for "aider"', () => {
    const adapter = AdapterFactory.getAdapter('aider');
    expect(adapter).toBeInstanceOf(AiderAdapter);
  });

  it('should return a ClaudeCodeAdapter for "claude"', () => {
    const adapter = AdapterFactory.getAdapter('claude');
    expect(adapter).toBeInstanceOf(ClaudeCodeAdapter);
  });

  it('should handle case-insensitive agent names', () => {
    const adapter = AdapterFactory.getAdapter('AIDER');
    expect(adapter).toBeInstanceOf(AiderAdapter);
  });

  it('should throw an error for an unknown agent name', () => {
    expect(() => AdapterFactory.getAdapter('unknown')).toThrow('Unknown agent name: unknown');
  });

  it('should throw an error if agentName is an empty string', () => {
    expect(() => AdapterFactory.getAdapter('')).toThrow('Agent name is required');
  });
});
