const ModelPricing: Record<string, { input: number; output: number }> = {
  'claude-3-5-sonnet-20240620': { input: 0.003, output: 0.015 },
  'gpt-4o': { input: 0.005, output: 0.015 },
};

function calculateCost(modelName: string, inputTokens: number, outputTokens: number): number {
  const pricing = ModelPricing[modelName];
  if (!pricing) return 0;
  return (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
}

export interface CostData {
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export interface CostParser {
  parse(stdout: string, modelName?: string): CostData | null;
}

export class NullCostParser implements CostParser {
  parse(_stdout: string, _modelName?: string): CostData | null {
    return null;
  }
}

export class AiderCostParser implements CostParser {
  parse(stdout: string, modelName?: string): CostData | null {
    const regex = /Total tokens: (\d+) \(input: (\d+), output: (\d+)\)/;
    const match = stdout.match(regex);
    if (!match) return null;

    const inputTokens = parseInt(match[2], 10);
    const outputTokens = parseInt(match[3], 10);

    return {
      inputTokens,
      outputTokens,
      cost: modelName ? calculateCost(modelName, inputTokens, outputTokens) : 0,
    };
  }
}

export class ClaudeCostParser implements CostParser {
  parse(stdout: string, modelName?: string): CostData | null {
    const inputRegex = /(\d{1,3}(?:,\d{3})*)\s*input\s*tokens?/;
    const outputRegex = /(\d{1,3}(?:,\d{3})*)\s*output\s*tokens?/;

    const inputMatch = stdout.match(inputRegex);
    const outputMatch = stdout.match(outputRegex);

    if (!inputMatch || !outputMatch) return null;

    const inputTokens = parseInt(inputMatch[1].replace(/,/g, ''), 10);
    const outputTokens = parseInt(outputMatch[1].replace(/,/g, ''), 10);

    return {
      inputTokens,
      outputTokens,
      cost: modelName ? calculateCost(modelName, inputTokens, outputTokens) : 0,
    };
  }
}

export class CostParserFactory {
  private static readonly registry: Map<string, () => CostParser> = new Map([
    ['aider', () => new AiderCostParser()],
    ['claude', () => new ClaudeCostParser()],
  ]);

  static getParser(agentName: string): CostParser {
    const parser = this.registry.get(agentName);
    if (parser) {
      return parser();
    }
    return new NullCostParser();
  }
}
