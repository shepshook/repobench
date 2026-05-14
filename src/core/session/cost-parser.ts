export interface CostData {
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export interface CostParser {
  parse(stdout: string): CostData | null;
}

export class NullCostParser implements CostParser {
  parse(_stdout: string): CostData | null {
    return null;
  }
}

export class AiderCostParser implements CostParser {
  parse(stdout: string): CostData | null {
    const regex = /Total tokens: (\d+) \(input: (\d+), output: (\d+)\)/;
    const match = stdout.match(regex);
    if (!match) return null;

    return {
      inputTokens: parseInt(match[2], 10),
      outputTokens: parseInt(match[3], 10),
      cost: 0,
    };
  }
}

export class ClaudeCostParser implements CostParser {
  parse(stdout: string): CostData | null {
    const inputRegex = /(\d{1,3}(?:,\d{3})*)\s*input\s*tokens?/;
    const outputRegex = /(\d{1,3}(?:,\d{3})*)\s*output\s*tokens?/;

    const inputMatch = stdout.match(inputRegex);
    const outputMatch = stdout.match(outputRegex);

    if (!inputMatch || !outputMatch) return null;

    return {
      inputTokens: parseInt(inputMatch[1].replace(/,/g, ''), 10),
      outputTokens: parseInt(outputMatch[1].replace(/,/g, ''), 10),
      cost: 0,
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
