import { ClaudeCodeAdapter } from '../../../../src/core/session/adapters/claude-code';
import { describe, it, expect } from 'vitest';

describe('ClaudeCodeAdapter', () => {
  it('should return the correct spawn config with extraArgs', () => {
    const adapter = new ClaudeCodeAdapter();
    const options = { 
      extraArgs: ['--dangerously-skip-permissions'] 
    };
    expect(adapter.getSpawnConfig(options)).toEqual({
      shell: 'claude',
      args: ['--dangerously-skip-permissions']
    });
  });

  it('should handle Claude Code-specific interactions', () => {
    const adapter = new ClaudeCodeAdapter();
    expect(adapter.getResponse('Run this command? (y/n)')).toBe('y\n');
    expect(adapter.getResponse('Allow this change? (y/n)')).toBe('y\n');
    expect(adapter.getResponse('Apply changes? (y/n)')).toBe('y\n');
    expect(adapter.getResponse('Continue? (y/n)')).toBe('y\n');
  });

  it('should return null for unknown interactions', () => {
    const adapter = new ClaudeCodeAdapter();
    expect(adapter.getResponse('Unknown prompt')).toBeNull();
  });
});
