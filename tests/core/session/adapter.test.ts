import { AgentAdapter } from '../../../src/core/session/adapter';
import { describe, it, expect } from 'vitest';

class MockAdapter extends AgentAdapter {
  protected spawnCommand = 'mock-agent --model {{model}} --api-key {{key}} {{extra}}';
  
  constructor() {
    super();
    this.addInteraction(/Do you agree\?/i, 'Yes\n');
  }
}

describe('AgentAdapter', () => {
  it('should correctly interpolate strings', () => {
    const adapter = new MockAdapter();
    const options = { model: 'gpt-4o', key: 'sk-123', extra: '--silent' };
    expect(adapter.getSpawnCommand(options)).toBe("mock-agent --model 'gpt-4o' --api-key 'sk-123' '--silent'");
  });

  it('should correctly interpolate arrays', () => {
    const adapter = new MockAdapter();
    const options = { 
      model: 'gpt-4o', 
      key: 'sk-123', 
      extra: ['--flag1', 'value1', '--flag2'] 
    };
    expect(adapter.getSpawnCommand(options)).toBe("mock-agent --model 'gpt-4o' --api-key 'sk-123' '--flag1' 'value1' '--flag2'");
  });

  it('should throw error when placeholders are missing', () => {
    const adapter = new MockAdapter();
    const options = { model: 'gpt-4o' };
    expect(() => adapter.getSpawnCommand(options)).toThrow(/Missing required options/);
  });

  it('should prevent shell injection', () => {
    const adapter = new MockAdapter();
    const options = { 
      model: 'gpt-4o', 
      key: "'; rm -rf /", 
      extra: 'safe' 
    };
    const result = adapter.getSpawnCommand(options);
    expect(result).toContain("'; rm -rf /'"); // Should be wrapped in single quotes
    expect(result).not.toContain("; rm -rf /"); // Should not be bare
  });

  it('should handle single quotes in arguments', () => {
    const adapter = new MockAdapter();
    const options = { model: 'gpt-4o', key: "it's a key", extra: 'safe' };
    expect(adapter.getSpawnCommand(options)).toContain("'it'\"'\"'s a key'");
  });

  it('should return correct response for matching regexes', () => {
    const adapter = new MockAdapter();
    expect(adapter.getResponse('Do you agree?')).toBe('Yes\n');
  });
});
