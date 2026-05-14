import { AiderAdapter } from '../../../../src/core/session/adapters/aider';
import { describe, it, expect } from 'vitest';

describe('AiderAdapter', () => {
  it('should return the correct spawn config with array args', () => {
    const adapter = new AiderAdapter();
    const options = { 
      model: 'gpt-4o', 
      extraArgs: ['--chat-mode', 'architect'] 
    };
    expect(adapter.getSpawnConfig(options)).toEqual({
      shell: 'aider',
      args: ['--model', 'gpt-4o', '--no-git', '--chat-mode', 'architect']
    });
  });

  it('should handle Aider-specific interactions', () => {
    const adapter = new AiderAdapter();
    expect(adapter.getResponse('Do you want to run the tests?')).toBe('Yes\n');
    expect(adapter.getResponse('Apply changes to file src/main.ts (y/n)')).toBe('y\n');
    expect(adapter.getResponse('Continue?')).toBe('y\n');
  });

  it('should return null for unknown interactions', () => {
    const adapter = new AiderAdapter();
    expect(adapter.getResponse('Unknown prompt')).toBeNull();
  });
});
