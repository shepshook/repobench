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

describe('AiderCostParser', () => {
  const parser = new AiderCostParser();

  it('should parse valid aider output', () => {
    const stdout = 'Total tokens: 1234 (input: 1000, output: 234)';
    expect(parser.parse(stdout)).toEqual({
      inputTokens: 1000,
      outputTokens: 234,
      cost: 0,
    });
  });

  it('should calculate cost for valid aider output when model name is provided', () => {
    const stdout = 'Total tokens: 1234 (input: 1000, output: 234)';
    const modelName = 'gpt-4o';
    // input: 1000 * 0.005/1k = 0.005
    // output: 234 * 0.015/1k = 0.00351
    // total: 0.00851
    expect(parser.parse(stdout, modelName)).toEqual({
      inputTokens: 1000,
      outputTokens: 234,
      cost: 0.00851,
    });
  });

  it('should return null for malformed aider output', () => {
    expect(parser.parse('Invalid output')).toBeNull();
    expect(parser.parse('Total tokens: abc (input: 100, output: 20)')).toBeNull();
  });
});

describe('ClaudeCostParser', () => {
  const parser = new ClaudeCostParser();

  it('should parse valid claude output with commas', () => {
    const stdout = 'Used 1,234 input tokens and 567 output tokens.';
    expect(parser.parse(stdout)).toEqual({
      inputTokens: 1234,
      outputTokens: 567,
      cost: 0,
    });
  });

  it('should calculate cost for valid claude output when model name is provided', () => {
    const stdout = 'Used 1,000 input tokens and 1,000 output tokens.';
    const modelName = 'claude-3-5-sonnet-20240620';
    // input: 1000 * 0.003/1k = 0.003
    // output: 1000 * 0.015/1k = 0.015
    // total: 0.018
    expect(parser.parse(stdout, modelName)).toEqual({
      inputTokens: 1000,
      outputTokens: 1000,
      cost: 0.018,
    });
  });

  it('should parse valid claude output without commas', () => {
    const stdout = '100 input tokens, 200 output tokens';
    expect(parser.parse(stdout)).toEqual({
      inputTokens: 100,
      outputTokens: 200,
      cost: 0,
    });
  });

  it('should return null for malformed claude output', () => {
    expect(parser.parse('Invalid output')).toBeNull();
    expect(parser.parse('100 input tokens')).toBeNull();
    expect(parser.parse('200 output tokens')).toBeNull();
  });
});

