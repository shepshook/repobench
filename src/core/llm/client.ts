import OpenAI from 'openai';
import { RepoBenchConfig } from '../config';

export class LLMClient {
  private client: OpenAI;
  private model: string;
  private temperature: number;

  constructor(config: RepoBenchConfig) {
    const apiKey = config.llm.api_key || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not found in config or environment variables (OPENAI_API_KEY)');
    }

    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: config.llm.endpoint,
    });
    this.model = config.llm.model;
    this.temperature = config.llm.temperature;
  }

  /**
   * Sends a chat request to the LLM.
   * @param systemPrompt The system prompt to guide the model.
   * @param userPrompt The user prompt.
   * @returns The model's response.
   * @throws Error if the API request fails.
   */
  async chat(systemPrompt: string, userPrompt: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: this.temperature,
      });

      return response.choices[0]?.message.content || '';
    } catch (error: any) {
      throw new Error(`LLM API request failed: ${error.message}`);
    }
  }
}
