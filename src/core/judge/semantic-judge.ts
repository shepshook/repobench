import { ISemanticJudge, SemanticEvaluation } from '../../types/contracts';
import { LLMClient } from '../llm/client';
import { RepoBenchConfig } from '../config';

export class SemanticJudge implements ISemanticJudge {
  private llmClient: LLMClient;

  constructor(config: RepoBenchConfig) {
    this.llmClient = new LLMClient(config);
  }

  async evaluate(bugDesc: string, groundTruth: string, agentFix: string): Promise<SemanticEvaluation> {
    const systemPrompt = `You are an expert software engineer judging the quality of an AI-generated bug fix.
You will be provided with a bug description, a ground truth fix, and an AI-generated fix.
Rate the AI-generated fix on a scale of 1-5 for the following metrics:
- Correctness: Does it solve the bug correctly?
- Maintainability: Is the code clean and easy to understand?
- Idiomaticity: Does it follow the language's best practices and idioms?

Return your response strictly as a JSON object with the following keys:
"correctness": number,
"maintainability": number,
"idiomaticity": number,
"justification": string`;

    const userPrompt = `Bug Description:
${bugDesc}

Ground Truth Fix:
${groundTruth}

AI-Generated Fix:
${agentFix}`;

    const response = await this.llmClient.chat(systemPrompt, userPrompt);
    
    try {
      const parsed = JSON.parse(response);
      return {
        correctness: parsed.correctness,
        maintainability: parsed.maintainability,
        idiomaticity: parsed.idiomaticity,
        justification: parsed.justification,
      };
    } catch (e) {
      throw new Error(`Failed to parse LLM response as JSON: ${response}`);
    }
  }
}
