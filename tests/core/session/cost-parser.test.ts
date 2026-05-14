import { describe, it, expect } from 'vitest';
import { CostParserFactory, AiderCostParser, ClaudeCostParser, NullCostParser } from '../../../src/core/session/cost-parser';

describe('CostParserFactory', () => {
  it('should return AiderCostParser for "aider"', () => {
    const parser = CostParserFactory.getParser('aider');
    expect(parser).toBeInstanceOf(AiderCostParser);
  });

  it('should return ClaudeCostParser for "claude"', () => {
    const parser = CostParserFactory.getParser('claude');
    expect(parser).toBeInstanceOf(ClaudeCostParser);
  });

  it('should return NullCostParser for unknown agent', () => {
    const parser = CostParserFactory.getParser('unknown');
    expect(parser).toBeInstanceOf(NullCostParser);
  });
});

describe('NullCostParser', () => {
  it('should always return null', () => {
    const parser = new NullCostParser();
    expect(parser.parse('some output')).toBeNull();
  });
});
