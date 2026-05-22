import OpenAI from 'openai';
import { ICurationService, Candidate, CurationResult, CurationResultSchema } from '../contracts.js';

export class OpenAICurationService implements ICurationService {
  private openai: OpenAI;
  private model: string;
  private promptTemplate: string;

  constructor(promptTemplate?: string) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.promptTemplate = promptTemplate || `
Given the following git commit candidate, evaluate its quality for benchmarking.
Candidate:
Hash: {{hash}}
Message: {{message}}
Files: {{files}}

Return a JSON object matching this schema:
{
  "score": number (0-1),
  "reasoning": string,
  "isApproved": boolean
}
`;
  }

  async curate(candidate: Candidate): Promise<CurationResult> {
    const prompt = this.promptTemplate
      .replace('{{hash}}', candidate.hash)
      .replace('{{message}}', candidate.message)
      .replace('{{files}}', candidate.files.join(', '));

    const maxRetries = 3;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lastError: any;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await this.openai.chat.completions.create({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0].message.content;
        if (!content) throw new Error('No content in response');
        
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const parsed = JSON.parse(content);
        return CurationResultSchema.parse({ ...parsed, rawResponse: content });
      } catch (error) {
        lastError = error;
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }
    throw lastError;
  }
}

export class NoOpCurationService implements ICurationService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  curate(_candidate: Candidate): Promise<CurationResult> {
    return Promise.resolve({
      score: 1,
      reasoning: 'No-op curation approved.',
      isApproved: true
    });
  }
}
