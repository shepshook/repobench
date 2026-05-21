import { ISemanticJudge } from '../contracts';
import { SemanticScore, SemanticScoreSchema } from '../entities/evaluation-results';

export class LLMSemanticJudge implements ISemanticJudge {
  private readonly maxRetries = 3;

  constructor(private readonly llmClient: { createChatCompletion: (params: any) => Promise<{ content: string }> }) {}

  async judge(code: string): Promise<SemanticScore> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.llmClient.createChatCompletion({
          messages: [
            {
              role: 'system',
              content: 'You are an expert code reviewer. Rate the provided code on a scale of 1 to 5 for correctness, maintainability, and idiomaticity. Output ONLY a JSON object with the keys "correctness", "maintainability", and "idiomaticity".',
            },
            {
              role: 'user',
              content: `Code to evaluate:\n\n${code}`,
            },
          ],
          response_format: { type: 'json_object' },
        });

        const parsed = JSON.parse(response.content);
        const result = SemanticScoreSchema.parse(parsed);
        return result;
      } catch (error: any) {
        lastError = error;
        if (attempt === this.maxRetries) break;
      }
    }

    throw lastError || new Error('Failed to judge code after maximum retries');
  }
}
