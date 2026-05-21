import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ISemanticJudge } from '../../../src/core/contracts';
import { LLMSemanticJudge } from '../../../src/core/services/llm-semantic-judge';
import { SemanticScore } from '../../../src/core/entities/evaluation-results';

describe('LLMSemanticJudge', () => {
  let judge: LLMSemanticJudge;
  let mockLlmClient: any;

  beforeEach(() => {
    mockLlmClient = {
      createChatCompletion: vi.fn(),
    };
    judge = new LLMSemanticJudge(mockLlmClient);
  });

  it('should successfully judge code and return a SemanticScore', async () => {
    const code = 'function add(a, b) { return a + b; }';
    const mockResponse = {
      content: JSON.stringify({
        correctness: 5,
        maintainability: 5,
        idiomaticity: 5,
      }),
    };
    mockLlmClient.createChatCompletion.mockResolvedValue(mockResponse);

    const result = await judge.judge(code);

    expect(result).toEqual({
      correctness: 5,
      maintainability: 5,
      idiomaticity: 5,
    });
    expect(mockLlmClient.createChatCompletion).toHaveBeenCalledWith(expect.objectContaining({
      messages: expect.arrayContaining([expect.objectContaining({ content: expect.stringContaining(code) })]),
    }));
  });

  it('should handle LLM API failures and retry', async () => {
    const code = 'function add(a, b) { return a + b; }';
    mockLlmClient.createChatCompletion
      .mockRejectedValueOnce(new Error('API Error 1'))
      .mockRejectedValueOnce(new Error('API Error 2'))
      .mockResolvedValue({
        content: JSON.stringify({
          correctness: 4,
          maintainability: 4,
          idiomaticity: 4,
        }),
      });

    const result = await judge.judge(code);

    expect(result.correctness).toBe(4);
    expect(mockLlmClient.createChatCompletion).toHaveBeenCalledTimes(3);
  });

  it('should handle malformed LLM responses and retry', async () => {
    const code = 'function add(a, b) { return a + b; }';
    mockLlmClient.createChatCompletion
      .mockResolvedValueOnce({ content: 'invalid json' })
      .mockResolvedValue({
        content: JSON.stringify({
          correctness: 3,
          maintainability: 3,
          idiomaticity: 3,
        }),
      });

    const result = await judge.judge(code);

    expect(result.correctness).toBe(3);
    expect(mockLlmClient.createChatCompletion).toHaveBeenCalledTimes(2);
  });

  it('should throw an error after maximum retries are exhausted', async () => {
    const code = 'function add(a, b) { return a + b; }';
    mockLlmClient.createChatCompletion.mockRejectedValue(new Error('Persistent API Error'));

    await expect(judge.judge(code)).rejects.toThrow('Persistent API Error');
  });
});
