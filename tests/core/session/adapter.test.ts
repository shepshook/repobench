import { AgentAdapter } from '../../../src/core/session/adapter';

class MockAdapter extends AgentAdapter {
  protected spawnCommand = 'agent-cli --model {{model}} --env {{env}}';
  protected interactionMap = new Map([
    [/hello/i, 'Hi there!'],
    [/ping/i, 'Pong!'],
    [/status/i, 'All systems go.']
  ]);
}

describe('AgentAdapter', () => {
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter();
  });

  describe('getSpawnCommand', () => {
    it('should correctly replace placeholders', () => {
      const options = { model: 'gpt-4o', env: 'production' };
      const result = adapter.getSpawnCommand(options);
      expect(result).toBe('agent-cli --model gpt-4o --env production');
    });

    it('should leave unmatched placeholders as is', () => {
      const options = { model: 'gpt-4o' };
      const result = adapter.getSpawnCommand(options);
      expect(result).toBe('agent-cli --model gpt-4o --env {{env}}');
    });
  });

  describe('getResponse', () => {
    it('should return the correct value for matching regexes', () => {
      expect(adapter.getResponse('Hello agent')).toBe('Hi there!');
      expect(adapter.getResponse('PING')).toBe('Pong!');
      expect(adapter.getResponse('What is the status?')).toBe('All systems go.');
    });

    it('should return null for non-matching input', () => {
      expect(adapter.getResponse('Unknown command')).toBeNull();
    });
  });
});
