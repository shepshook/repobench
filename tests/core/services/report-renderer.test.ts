import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LeaderboardEntry, IReportRenderer } from '../../../src/core/contracts';
import { TerminalReportRenderer } from '../../../src/core/services/report-renderer';

const columnHeaders = ['Rank', 'Agent ID', 'Runs', 'Passed', 'Failed', 'Success Rate', 'Avg E-Score', 'Avg Cost', 'Avg Latency'];

function sampleEntries(): LeaderboardEntry[] {
  return [
    {
      rank: 1,
      agentId: 'aider',
      totalRuns: 12,
      successfulRuns: 10,
      failedRuns: 2,
      successRate: 10 / 12,
      avgEScore: 0.784,
      avgCost: 0.45,
      avgLatency: 182.3,
    },
    {
      rank: 2,
      agentId: 'claude-code',
      totalRuns: 12,
      successfulRuns: 8,
      failedRuns: 4,
      successRate: 8 / 12,
      avgEScore: 0.612,
      avgCost: 0.62,
      avgLatency: 245.1,
    },
  ];
}

describe('IReportRenderer', () => {
  it('should be implementable by a mock class with correct signature', () => {
    class MockRenderer implements IReportRenderer {
      render(entries: LeaderboardEntry[]): string {
        return entries.length === 0 ? 'No data available.' : 'mock rendered';
      }
    }
    const renderer: IReportRenderer = new MockRenderer();
    expect(renderer.render([])).toBe('No data available.');
    expect(renderer.render(sampleEntries())).toBe('mock rendered');
  });
});

describe('TerminalReportRenderer', () => {
  it('should return "No data available." for empty entries', () => {
    const renderer = new TerminalReportRenderer();
    const output = renderer.render([]);
    expect(output).toBe('No data available.');
  });

  it('should render all column headers in the output', () => {
    const renderer = new TerminalReportRenderer();
    const output = renderer.render(sampleEntries());
    for (const header of columnHeaders) {
      expect(output).toContain(header);
    }
  });

  it('should include both entries in the output', () => {
    const renderer = new TerminalReportRenderer();
    const output = renderer.render(sampleEntries());
    expect(output).toContain('aider');
    expect(output).toContain('claude-code');
  });

  it('should format success rate as percentage with 2 decimal places', () => {
    const renderer = new TerminalReportRenderer();
    const output = renderer.render(sampleEntries());
    expect(output).toContain('83.33%');
    expect(output).toContain('66.67%');
  });

  it('should format cost as currency with $X.XX', () => {
    const renderer = new TerminalReportRenderer();
    const output = renderer.render(sampleEntries());
    expect(output).toContain('$0.45');
    expect(output).toContain('$0.62');
  });

  it('should format latency in seconds with 1 decimal place', () => {
    const renderer = new TerminalReportRenderer();
    const output = renderer.render(sampleEntries());
    expect(output).toContain('182.3s');
    expect(output).toContain('245.1s');
  });

  it('should format E-Score with 3 decimal places', () => {
    const renderer = new TerminalReportRenderer();
    const output = renderer.render(sampleEntries());
    expect(output).toContain('0.784');
    expect(output).toContain('0.612');
  });

  it('should display rank column with correct ordering', () => {
    const renderer = new TerminalReportRenderer();
    const output = renderer.render(sampleEntries());
    const lines = output.split('\n').filter(l => l.trim().length > 0);
    const rankLine1 = lines.find(l => l.includes('aider'));
    const rankLine2 = lines.find(l => l.includes('claude-code'));
    expect(rankLine1).toBeDefined();
    expect(rankLine2).toBeDefined();
    if (rankLine1 && rankLine2) {
      const idx1 = lines.indexOf(rankLine1);
      const idx2 = lines.indexOf(rankLine2);
      expect(idx1).toBeLessThan(idx2);
    }
  });

  it('should render separator line between header and data', () => {
    const renderer = new TerminalReportRenderer();
    const output = renderer.render(sampleEntries());
    expect(output).toContain('─');
    expect(output).toContain('┼');
  });

  it('should handle a single entry correctly', () => {
    const renderer = new TerminalReportRenderer();
    const single: LeaderboardEntry[] = [
      {
        rank: 1,
        agentId: 'single-agent',
        totalRuns: 5,
        successfulRuns: 5,
        failedRuns: 0,
        successRate: 1,
        avgEScore: 0.999,
        avgCost: 0.1,
        avgLatency: 100.0,
      },
    ];
    const output = renderer.render(single);
    expect(output).toContain('single-agent');
    expect(output).toContain('100.00%');
    expect(output).toContain('$0.10');
    expect(output).toContain('100.0s');
    expect(output).toContain('0.999');
  });

  it('should handle zero values correctly', () => {
    const renderer = new TerminalReportRenderer();
    const zero: LeaderboardEntry[] = [
      {
        rank: 1,
        agentId: 'zero-agent',
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
        successRate: 0,
        avgEScore: 0,
        avgCost: 0,
        avgLatency: 0,
      },
    ];
    const output = renderer.render(zero);
    expect(output).toContain('0.00%');
    expect(output).toContain('$0.00');
    expect(output).toContain('0.0s');
    expect(output).toContain('0.000');
  });
});

describe('TerminalReportRenderer – console.table fallback', () => {
  let originalColumns: number | undefined;

  beforeEach(() => {
    originalColumns = (process.stdout as any).columns;
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, 'columns', {
      value: originalColumns,
      configurable: true,
      writable: true,
    });
  });

  it('should fall back to console.table when terminal width is too narrow', () => {
    Object.defineProperty(process.stdout, 'columns', {
      value: 30,
      configurable: true,
      writable: true,
    });

    const tableSpy = vi.spyOn(console, 'table').mockImplementation(() => {});
    const renderer = new TerminalReportRenderer();
    renderer.render(sampleEntries());

    expect(tableSpy).toHaveBeenCalled();
    tableSpy.mockRestore();
  });

  it('should fall back to console.table when terminal width cannot be detected', () => {
    Object.defineProperty(process.stdout, 'columns', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const tableSpy = vi.spyOn(console, 'table').mockImplementation(() => {});
    const renderer = new TerminalReportRenderer();
    renderer.render(sampleEntries());

    expect(tableSpy).toHaveBeenCalled();
    tableSpy.mockRestore();
  });

  it('should call console.table AND include entry data when falling back', () => {
    Object.defineProperty(process.stdout, 'columns', {
      value: 20,
      configurable: true,
      writable: true,
    });

    const tableSpy = vi.spyOn(console, 'table').mockImplementation(() => {});
    const renderer = new TerminalReportRenderer();
    const output = renderer.render(sampleEntries());

    expect(tableSpy).toHaveBeenCalled();
    expect(output).toContain('aider');
    expect(output).toContain('claude-code');
    tableSpy.mockRestore();
  });

  it('should use console.table row-separator characters in fallback output', () => {
    Object.defineProperty(process.stdout, 'columns', {
      value: 10,
      configurable: true,
      writable: true,
    });

    const renderer = new TerminalReportRenderer();
    const output = renderer.render(sampleEntries());

    // console.table uses ├ and ┤ as row-separator edges (vs ┼ for column-only in custom format)
    expect(output).toContain('├');
    expect(output).toContain('┤');
  });
});
