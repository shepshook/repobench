import { ClaudeCodeAdapter } from '../../../../src/core/session/adapters/claude-code';
import { describe, it, expect } from 'vitest';

describe('ClaudeCodeAdapter', () => {
  it('should return the correct spawn command with extraArgs', () => {
    const adapter = new ClaudeCodeAdapter();
    const options = { 
      extraArgs: ['--dangerously-skip-permissions'] 
    };
    expect(adapter.getSpawnCommand(options)).toBe("claude '--dangerously-skip-permissions'");
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
