import { describe, it, expect } from 'vitest';
import { AiderAdapter } from '../../../src/core/session/adapters/aider';

describe('AiderAdapter', () => {
  const adapter = new AiderAdapter();

  it('returns the expected spawn command', () => {
    const options = { model: 'gpt-4o', flags: '--no-git' };
    expect(adapter.getSpawnCommand(options)).toBe('aider gpt-4o --no-git');
  });

  it('responds "y" to "Do you want to apply these changes?"', () => {
    const input = 'Do you want to apply these changes? [y/n]';
    expect(adapter.getResponse(input)).toBe('y');
  });

  it('responds "y" to "Confirm to start?"', () => {
    const input = 'Confirm to start? [y/n]';
    expect(adapter.getResponse(input)).toBe('y');
  });

  it('responds with OpenAI API key when prompted', () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const dynamicAdapter = new AiderAdapter();
    const input = 'Enter your OpenAI API key:';
    expect(dynamicAdapter.getResponse(input)).toBe('test-key');
    delete process.env.OPENAI_API_KEY;
  });

  it('returns null for unknown prompts', () => {
    const input = 'What is your name?';
    expect(adapter.getResponse(input)).toBeNull();
  });
});
