import { AgentAdapter } from '../../../src/core/session/adapter';
import { describe, it, expect } from 'vitest';

class MockAdapter extends AgentAdapter {
  protected shell = 'mock-agent';
  
  protected getArgs(options: Record<string, string | string[]>): string[] {
    const args: string[] = [];
    if (options.model) args.push('--model', options.model as string);
    if (options.key) args.push('--api-key', options.key as string);
    args.push(...this.expandArgs(options.extra));
    return args;
  }
  
  constructor() {
    super();
    this.addInteraction(/Do you agree\?/i, 'Yes\n');
  }
}

describe('AgentAdapter', () => {
  it('should correctly generate spawn config', () => {
    const adapter = new MockAdapter();
    const options = { model: 'gpt-4o', key: 'sk-123', extra: '--silent' };
    expect(adapter.getSpawnConfig(options)).toEqual({
      shell: 'mock-agent',
      args: ['--model', 'gpt-4o', '--api-key', 'sk-123', '--silent']
    });
  });

  it('should correctly handle array args in spawn config', () => {
    const adapter = new MockAdapter();
    const options = { 
      model: 'gpt-4o', 
      key: 'sk-123', 
      extra: ['--flag1', 'value1', '--flag2'] 
    };
    expect(adapter.getSpawnConfig(options)).toEqual({
      shell: 'mock-agent',
      args: ['--model', 'gpt-4o', '--api-key', 'sk-123', '--flag1', 'value1', '--flag2']
    });
  });

  it('should return correct response for matching regexes', () => {
    const adapter = new MockAdapter();
    expect(adapter.getResponse('Do you agree?')).toBe('Yes\n');
  });
});
