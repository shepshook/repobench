import { describe, it, expect, vi } from 'vitest';
import { SemanticJudge } from '../../../src/core/judge/semantic-judge';
import { LLMClient } from '../../../src/core/llm/client';
import { RepoBenchConfig } from '../../../src/core/config';

vi.mock('../../src/core/llm/client');

describe('SemanticJudge', () => {
  const mockConfig: RepoBenchConfig = {
    llm: {
      api_key: 'test',
      endpoint: 'http://test',
      model: 'gpt-4',
      temperature: 0,
    },
    // Add other required config fields here
  } as any;

  it('should evaluate a fix and return a SemanticEvaluation object', async () => {
    const judge = new SemanticJudge(mockConfig);
    const mockResponse = JSON.stringify({
      correctness: 5,
      maintainability: 4,
      idiomaticity: 5,
      justification: 'The fix is perfect and idiomatic.',
    });
    
    const chatSpy = vi.spyOn(LLMClient.prototype, 'chat').mockResolvedValue(mockResponse);

    const result = await judge.evaluate('Bug description', 'Truth', 'Fix');

    expect(result).toEqual({
      correctness: 5,
      maintainability: 4,
      idiomaticity: 5,
      justification: 'The fix is perfect and idiomatic.',
    });
    expect(chatSpy).toHaveBeenCalled();
  });

  it('should throw an error if LLM response is not valid JSON', async () => {
    const judge = new SemanticJudge(mockConfig);
    vi.spyOn(LLMClient.prototype, 'chat').mockResolvedValue('Not JSON');

    await expect(judge.evaluate('Bug description', 'Truth', 'Fix')).rejects.toThrow('Failed to parse LLM response as JSON');
  });

});
