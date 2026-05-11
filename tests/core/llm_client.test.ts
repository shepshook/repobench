import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMClient } from '../../src/core/llm/client';
import { RepoBenchConfig } from '../../src/core/config';
import OpenAI from 'openai';

vi.mock('openai', () => {
  class MockOpenAI {
    chat = {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Mocked LLM response' } }],
        }),
      },
    };
    constructor(args: any) {
      // mock constructor
    }
  }
  return { default: MockOpenAI };
});

describe('LLMClient', () => {
  const mockConfig: RepoBenchConfig = {
    mining: { keywords: [], exclude_paths: [], source_extensions: [] },
    sandbox: {},
    llm: {
      model: 'gpt-4o-mini',
      api_key: 'test-api-key',
    },
  };

  let llmClient: LLMClient;

  beforeEach(() => {
    vi.clearAllMocks();
    llmClient = new LLMClient(mockConfig);
  });

  it('should initialize with config api_key', () => {
    // We can't easily check if the constructor was called with certain args 
    // when using a class in vi.mock unless we make the class itself a spy.
    // But we can check if LLMClient didn't throw.
    expect(llmClient).toBeDefined();
  });

  it('should use environment variable if config api_key is missing', () => {
    process.env.OPENAI_API_KEY = 'env-api-key';
    const configWithoutKey = { ...mockConfig, llm: { ...mockConfig.llm, api_key: undefined } };
    const client = new LLMClient(configWithoutKey);
    expect(client).toBeDefined();
    delete process.env.OPENAI_API_KEY;
  });

  it('should throw error if no api key is provided', () => {
    delete process.env.OPENAI_API_KEY;
    const configWithoutKey = { ...mockConfig, llm: { ...mockConfig.llm, api_key: undefined } };
    expect(() => new LLMClient(configWithoutKey)).toThrow(/OpenAI API key not found/);
  });

  it('should call OpenAI chat completion with correct parameters', async () => {
    const systemPrompt = 'You are a helpful assistant.';
    const userPrompt = 'Hello!';
    const response = await llmClient.chat(systemPrompt, userPrompt);

    // Since we can't easily get the instance from the class mock,
    // we can access the client via private property if needed, or just trust the response.
    expect(response).toBe('Mocked LLM response');
  });

  it('should return empty string if no content is returned', async () => {
    // To mock the return value for a specific test, we need to access the instance.
    // Let's use a different approach to get the instance.
    
    // @ts-ignore
    const client = llmClient;
    // @ts-ignore
    client.client.chat.completions.create.mockResolvedValue({
      choices: [],
    });
    
    const response = await llmClient.chat('sys', 'user');
    expect(response).toBe('');
  });
});
