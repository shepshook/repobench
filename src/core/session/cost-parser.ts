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
    // TODO: Implement actual parsing logic for aider
    return null;
  }
}

export class ClaudeCostParser implements CostParser {
  parse(stdout: string): CostData | null {
    // TODO: Implement actual parsing logic for claude
    return null;
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
