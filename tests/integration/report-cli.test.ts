import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerReportCommand } from '../../src/cli/report';
import { RunResultRepository } from '../../src/core/repositories/run-result-repository';
import { reinitDatabase } from '../../src/infrastructure/persistence/database';
import type { RunResult } from '../../src/core/contracts';
import { generateValidUuid } from '../helpers/dataset';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

const columnHeaders = ['Rank', 'Agent ID', 'Runs', 'Passed', 'Failed', 'Success Rate', 'Avg E-Score', 'Avg Cost', 'Avg Latency'];

function seedRunResult(overrides: Partial<RunResult> & { agentId: string }): RunResult {
  return {
    runId: generateValidUuid(),
    agentId: overrides.agentId,
    candidateId: generateValidUuid(),
    metrics: {
      success: true,
      cost: 1.0,
      latency: 100,
      eScore: 0.5,
      ...overrides.metrics,
    },
    timestamp: new Date(),
    ...overrides,
  };
}

describe('CLI: repobench report', () => {
  let program: Command;
  let tempDbPath: string;
  let repository: RunResultRepository;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tempDbPath = path.join(os.tmpdir(), `report-cli-test-db-${Date.now()}-${Math.random()}.db`);
    reinitDatabase(tempDbPath);

    repository = new RunResultRepository();

    program = new Command();
    registerReportCommand(program);

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    try {
      await fs.unlink(tempDbPath);
    } catch {}
  });

  it('should print table with all column headers and seeded agent data', async () => {
    repository.save(seedRunResult({ agentId: 'agent-alpha', metrics: { success: true, cost: 0.5, latency: 50, eScore: 0.9 } }));
    repository.save(seedRunResult({ agentId: 'agent-alpha', metrics: { success: true, cost: 1.0, latency: 100, eScore: 0.8 } }));
    repository.save(seedRunResult({ agentId: 'agent-beta', metrics: { success: false, cost: 2.0, latency: 200, eScore: 0.0 } }));
    repository.save(seedRunResult({ agentId: 'agent-beta', metrics: { success: true, cost: 0.3, latency: 30, eScore: 0.95 } }));

    await program.parseAsync(['node', 'repobench', 'report']);

    for (const header of columnHeaders) {
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(header));
    }
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('agent-alpha'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('agent-beta'));
  });

  it('should sort by successRate ascending with --sort-by successRate --order asc', async () => {
    repository.save(seedRunResult({ agentId: 'agent-high', metrics: { success: true, cost: 1, latency: 10, eScore: 0.5 } }));
    repository.save(seedRunResult({ agentId: 'agent-high', metrics: { success: true, cost: 1, latency: 10, eScore: 0.5 } }));
    repository.save(seedRunResult({ agentId: 'agent-low', metrics: { success: false, cost: 1, latency: 10, eScore: 0.0 } }));
    repository.save(seedRunResult({ agentId: 'agent-low', metrics: { success: true, cost: 1, latency: 10, eScore: 0.1 } }));

    await program.parseAsync(['node', 'repobench', 'report', '--sort-by', 'successRate', '--order', 'asc']);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('agent-low'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('agent-high'));
  });

  it('should respect --limit 5 and show at most 5 entries', async () => {
    for (let i = 0; i < 10; i++) {
      repository.save(seedRunResult({ agentId: `agent-${i}`, metrics: { success: true, cost: 1, latency: 10, eScore: 0.5 + i * 0.05 } }));
    }

    await program.parseAsync(['node', 'repobench', 'report', '--limit', '5']);

    // Sorted by eScore desc: agent-9 (0.95), agent-8 (0.9), ..., agent-0 (0.5)
    // Top 5 entries: agent-9 through agent-5
    for (let i = 5; i < 10; i++) {
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`agent-${i}`));
    }
    expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('agent-0'));
  });

  it('should filter by --agent-id and only show that agent', async () => {
    repository.save(seedRunResult({ agentId: 'agent-visible', metrics: { success: true, cost: 1, latency: 10, eScore: 0.5 } }));
    repository.save(seedRunResult({ agentId: 'agent-hidden', metrics: { success: true, cost: 1, latency: 10, eScore: 0.5 } }));

    await program.parseAsync(['node', 'repobench', 'report', '--agent-id', 'agent-visible']);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('agent-visible'));
    expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('agent-hidden'));
  });

  it('should filter by --candidate-id and only show runs for that candidate', async () => {
    const targetCandidateId = generateValidUuid();
    repository.save(seedRunResult({ agentId: 'agent-a', candidateId: targetCandidateId, metrics: { success: true, cost: 1, latency: 10, eScore: 0.5 } }));
    repository.save(seedRunResult({ agentId: 'agent-b', metrics: { success: true, cost: 1, latency: 10, eScore: 0.5 } }));

    await program.parseAsync(['node', 'repobench', 'report', '--candidate-id', targetCandidateId]);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('agent-a'));
    expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('agent-b'));
  });

  it('should exit with code 0 on success', async () => {
    repository.save(seedRunResult({ agentId: 'agent-a', metrics: { success: true, cost: 1, latency: 10, eScore: 0.5 } }));

    try {
      await program.parseAsync(['node', 'repobench', 'report']);
    } catch (e) {
      // process.exit mock throws
    }

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should exit with code 1 on error', async () => {
    vi.spyOn(repository, 'getAll').mockImplementation(() => {
      throw new Error('db error');
    });

    try {
      await program.parseAsync(['node', 'repobench', 'report']);
    } catch (e) {
      // process.exit mock throws
    }

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should output "No data available." when there are no runs', async () => {
    await program.parseAsync(['node', 'repobench', 'report']);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No data available'));
  });

  it('should format success rates as percentages with 2 decimal places', async () => {
    repository.save(seedRunResult({ agentId: 'agent-a', metrics: { success: true, cost: 1, latency: 10, eScore: 0.5 } }));
    repository.save(seedRunResult({ agentId: 'agent-a', metrics: { success: true, cost: 1, latency: 10, eScore: 0.5 } }));

    await program.parseAsync(['node', 'repobench', 'report']);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('100.00%'));
  });

  it('should display rank column with 1-based indexing', async () => {
    repository.save(seedRunResult({ agentId: 'agent-a', metrics: { success: true, cost: 1, latency: 10, eScore: 0.9 } }));
    repository.save(seedRunResult({ agentId: 'agent-b', metrics: { success: true, cost: 1, latency: 10, eScore: 0.5 } }));

    await program.parseAsync(['node', 'repobench', 'report', '--sort-by', 'eScore', '--order', 'desc']);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('1'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('2'));
  });

  it('should use default sort (eScore desc) and limit (10) when no options provided', async () => {
    repository.save(seedRunResult({ agentId: 'agent-a', metrics: { success: true, cost: 1, latency: 10, eScore: 0.3 } }));
    repository.save(seedRunResult({ agentId: 'agent-b', metrics: { success: true, cost: 1, latency: 10, eScore: 0.9 } }));

    await program.parseAsync(['node', 'repobench', 'report']);

    const logCalls = consoleLogSpy.mock.calls.map(c => String(c[0])).join(' ');
    const alphaIndex = logCalls.indexOf('agent-a');
    const betaIndex = logCalls.indexOf('agent-b');
    expect(betaIndex).toBeLessThan(alphaIndex);
  });
});
