import { ICostParser, CostMetrics } from '../contracts';

export class CostParser implements ICostParser {
  parse(logs: string): CostMetrics {
    const metrics: CostMetrics = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cost: 0,
      currency: 'USD',
    };

    const patterns = [
      { regex: /Prompt tokens:\s*(\d+)/gi, key: 'promptTokens' as const, type: 'int' },
      { regex: /Completion tokens:\s*(\d+)/gi, key: 'completionTokens' as const, type: 'int' },
      { regex: /Total tokens used:\s*(\d+)/gi, key: 'totalTokens' as const, type: 'int' },
      { regex: /(\d+)\s*prompt/gi, key: 'promptTokens' as const, type: 'int' },
      { regex: /(\d+)\s*completion/gi, key: 'completionTokens' as const, type: 'int' },
      { regex: /Cost:\s*\$?([\d.]+)/gi, key: 'cost' as const, type: 'float' },
      { regex: /Cost:\s*[\d.]+\s*([A-Z]{3})/gi, key: 'currency' as const, type: 'string' },
    ];

    for (const { regex, key, type } of patterns) {
      let match;
      regex.lastIndex = 0;
      while ((match = regex.exec(logs)) !== null) {
        const value = match[1];
        if (type === 'int') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
          (metrics as any)[key] = parseInt(value, 10);
        } else if (type === 'float') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
          (metrics as any)[key] = parseFloat(value);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
          (metrics as any)[key] = value;
        }
      }
    }

    // Recalculate total if missing and prompt/completion are present
    if (metrics.totalTokens === 0 && (metrics.promptTokens > 0 || metrics.completionTokens > 0)) {
      metrics.totalTokens = metrics.promptTokens + metrics.completionTokens;
    }

    return metrics;
  }
}
