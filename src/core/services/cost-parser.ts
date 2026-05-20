import { ICostParser, CostMetrics } from '../contracts';

export class CostParser implements ICostParser {
  private readonly patterns = [
    {
      // Standard format: "Prompt tokens: 123, Completion tokens: 45, Cost: 0.012 USD"
      regex: /Prompt tokens:\s*(\d+),\s*Completion tokens:\s*(\d+),\s*Cost:\s*([\d.]+)\s*([A-Z]{3})/gi,
      map: (match: string[]) => ({
        promptTokens: parseInt(match[1], 10),
        completionTokens: parseInt(match[2], 10),
        totalTokens: parseInt(match[1], 10) + parseInt(match[2], 10),
        cost: parseFloat(match[3]),
        currency: match[4],
      }),
    },
    {
      // Alternative format: "Total tokens used: 168 (123 prompt, 45 completion). Cost: $0.012"
      regex: /Total tokens used:\s*(\d+)\s*\((\d+)\s*prompt,\s*(\d+)\s*completion\)\.\s*Cost:\s*\$?([\d.]+)/gi,
      map: (match: string[]) => ({
        promptTokens: parseInt(match[2], 10),
        completionTokens: parseInt(match[3], 10),
        totalTokens: parseInt(match[1], 10),
        cost: parseFloat(match[4]),
        currency: 'USD', // Default for $ symbol or this format
      }),
    },
  ];

  parse(logs: string): CostMetrics {
    let lastMetrics: CostMetrics | null = null;

    for (const { regex, map } of this.patterns) {
      let match;
      // Reset regex lastIndex because of 'g' flag
      regex.lastIndex = 0;
      while ((match = regex.exec(logs)) !== null) {
        lastMetrics = map(match);
      }
    }

    if (lastMetrics) {
      return lastMetrics;
    }

    return {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cost: 0,
      currency: 'USD',
    };
  }
}
