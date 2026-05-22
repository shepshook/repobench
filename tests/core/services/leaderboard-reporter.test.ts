import { describe, it, expect, beforeEach } from 'vitest';
import { LeaderboardReporter } from '../../../src/core/services/leaderboard-reporter';
import {
  IRunResultRepository,
  type RunResult,
  type LeaderboardOptions,
  type LeaderboardEntry,
} from '../../../src/core/contracts';

function createMockRunResult(overrides: Partial<RunResult> & { agentId: string }): RunResult {
  return {
    runId: overrides.runId ?? '00000000-0000-0000-0000-000000000001',
    agentId: overrides.agentId,
    candidateId: overrides.candidateId ?? '00000000-0000-0000-0000-000000000010',
    metrics: {
      success: overrides.metrics?.success ?? true,
      cost: overrides.metrics?.cost ?? 1.0,
      latency: overrides.metrics?.latency ?? 100,
      eScore: overrides.metrics?.eScore ?? 0.5,
    },
    timestamp: overrides.timestamp ?? new Date(),
    logPath: overrides.logPath,
  };
}

function createMockRepository(results: RunResult[]): IRunResultRepository {
  return {
    save: () => {},
    getById: () => undefined,
    getAll: () => results,
    getByAgentId: (agentId: string) => results.filter(r => r.agentId === agentId),
    getByCandidateId: (candidateId: string) => results.filter(r => r.candidateId === candidateId),
  };
}

const agentA = 'agent-a';
const agentB = 'agent-b';

function makeSampleRuns(): RunResult[] {
  return [
    // agent-a: 3 runs, 2 success
    createMockRunResult({ agentId: agentA, metrics: { success: true, cost: 1.0, latency: 100, eScore: 0.9 } }),
    createMockRunResult({ agentId: agentA, metrics: { success: true, cost: 2.0, latency: 200, eScore: 0.8 } }),
    createMockRunResult({ agentId: agentA, metrics: { success: false, cost: 3.0, latency: 300, eScore: 0.0 } }),
    // agent-b: 2 runs, 1 success
    createMockRunResult({ agentId: agentB, metrics: { success: true, cost: 0.5, latency: 50, eScore: 0.95 } }),
    createMockRunResult({ agentId: agentB, metrics: { success: false, cost: 1.5, latency: 150, eScore: 0.1 } }),
  ];
}

describe('LeaderboardReporter', () => {
  let repo: IRunResultRepository;

  beforeEach(() => {
    repo = createMockRepository(makeSampleRuns());
  });

  it('should compute aggregation math for a single agent', async () => {
    const reporter = new LeaderboardReporter(repo);
    const result = await reporter.getLeaderboard({ sortBy: 'eScore', sortOrder: 'desc', limit: 10, agentId: agentA });
    expect(result).toHaveLength(1);
    const entry = result[0];
    expect(entry.agentId).toBe(agentA);
    expect(entry.totalRuns).toBe(3);
    expect(entry.successfulRuns).toBe(2);
    expect(entry.failedRuns).toBe(1);
    expect(entry.successRate).toBeCloseTo(2 / 3);
    expect(entry.avgEScore).toBeCloseTo((0.9 + 0.8 + 0.0) / 3);
    expect(entry.avgCost).toBeCloseTo((1.0 + 2.0 + 3.0) / 3);
    expect(entry.avgLatency).toBeCloseTo((100 + 200 + 300) / 3);
  });

  it('should return entries for all agents when no filter is applied', async () => {
    const reporter = new LeaderboardReporter(repo);
    const result = await reporter.getLeaderboard({ sortBy: 'eScore', sortOrder: 'desc', limit: 10 });
    expect(result).toHaveLength(2);
    expect(result.map(e => e.agentId)).toEqual(expect.arrayContaining([agentA, agentB]));
  });

  it('should sort by eScore descending by default', async () => {
    const reporter = new LeaderboardReporter(repo);
    const result = await reporter.getLeaderboard({});
    expect(result[0].avgEScore).toBeGreaterThanOrEqual(result[1].avgEScore);
  });

  it('should sort by eScore ascending', async () => {
    const reporter = new LeaderboardReporter(repo);
    const result = await reporter.getLeaderboard({ sortBy: 'eScore', sortOrder: 'asc' });
    expect(result[0].avgEScore).toBeLessThanOrEqual(result[1].avgEScore);
  });

  it('should sort by successRate descending', async () => {
    const reporter = new LeaderboardReporter(repo);
    const result = await reporter.getLeaderboard({ sortBy: 'successRate', sortOrder: 'desc' });
    expect(result[0].successRate).toBeGreaterThanOrEqual(result[1].successRate);
  });

  it('should sort by successRate ascending', async () => {
    const reporter = new LeaderboardReporter(repo);
    const result = await reporter.getLeaderboard({ sortBy: 'successRate', sortOrder: 'asc' });
    expect(result[0].successRate).toBeLessThanOrEqual(result[1].successRate);
  });

  it('should sort by cost descending', async () => {
    const reporter = new LeaderboardReporter(repo);
    const result = await reporter.getLeaderboard({ sortBy: 'cost', sortOrder: 'desc' });
    expect(result[0].avgCost).toBeGreaterThanOrEqual(result[1].avgCost);
  });

  it('should sort by cost ascending', async () => {
    const reporter = new LeaderboardReporter(repo);
    const result = await reporter.getLeaderboard({ sortBy: 'cost', sortOrder: 'asc' });
    expect(result[0].avgCost).toBeLessThanOrEqual(result[1].avgCost);
  });

  it('should sort by latency descending', async () => {
    const reporter = new LeaderboardReporter(repo);
    const result = await reporter.getLeaderboard({ sortBy: 'latency', sortOrder: 'desc' });
    expect(result[0].avgLatency).toBeGreaterThanOrEqual(result[1].avgLatency);
  });

  it('should sort by latency ascending', async () => {
    const reporter = new LeaderboardReporter(repo);
    const result = await reporter.getLeaderboard({ sortBy: 'latency', sortOrder: 'asc' });
    expect(result[0].avgLatency).toBeLessThanOrEqual(result[1].avgLatency);
  });

  it('should sort by runs descending', async () => {
    const reporter = new LeaderboardReporter(repo);
    const result = await reporter.getLeaderboard({ sortBy: 'runs', sortOrder: 'desc' });
    expect(result[0].totalRuns).toBeGreaterThanOrEqual(result[1].totalRuns);
  });

  it('should sort by runs ascending', async () => {
    const reporter = new LeaderboardReporter(repo);
    const result = await reporter.getLeaderboard({ sortBy: 'runs', sortOrder: 'asc' });
    expect(result[0].totalRuns).toBeLessThanOrEqual(result[1].totalRuns);
  });

  it('should respect the limit parameter', async () => {
    const repo3 = createMockRepository([
      createMockRunResult({ agentId: 'agent-x', metrics: { success: true, cost: 1, latency: 10, eScore: 0.5 } }),
      createMockRunResult({ agentId: 'agent-y', metrics: { success: true, cost: 1, latency: 10, eScore: 0.6 } }),
      createMockRunResult({ agentId: 'agent-z', metrics: { success: true, cost: 1, latency: 10, eScore: 0.7 } }),
    ]);
    const reporter = new LeaderboardReporter(repo3);
    const result = await reporter.getLeaderboard({ sortBy: 'eScore', sortOrder: 'desc', limit: 2 });
    expect(result).toHaveLength(2);
  });

  it('should filter by agentId', async () => {
    const reporter = new LeaderboardReporter(repo);
    const result = await reporter.getLeaderboard({ agentId: agentB });
    expect(result).toHaveLength(1);
    expect(result[0].agentId).toBe(agentB);
  });

  it('should return empty array when no results exist', async () => {
    const emptyRepo = createMockRepository([]);
    const reporter = new LeaderboardReporter(emptyRepo);
    const result = await reporter.getLeaderboard({});
    expect(result).toEqual([]);
  });

  it('should assign rank sequentially (1-based)', async () => {
    const repo3 = createMockRepository([
      createMockRunResult({ agentId: 'agent-a', metrics: { success: true, cost: 1, latency: 10, eScore: 0.5 } }),
      createMockRunResult({ agentId: 'agent-b', metrics: { success: true, cost: 1, latency: 10, eScore: 0.6 } }),
      createMockRunResult({ agentId: 'agent-c', metrics: { success: true, cost: 1, latency: 10, eScore: 0.7 } }),
    ]);
    const reporter = new LeaderboardReporter(repo3);
    const result = await reporter.getLeaderboard({ sortBy: 'eScore', sortOrder: 'desc' });
    expect(result).toHaveLength(3);
    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(2);
    expect(result[2].rank).toBe(3);
  });

  it('should handle all-failure runs with zero successRate', async () => {
    const allFail = createMockRepository([
      createMockRunResult({ agentId: agentA, metrics: { success: false, cost: 1, latency: 10, eScore: 0.0 } }),
    ]);
    const reporter = new LeaderboardReporter(allFail);
    const result = await reporter.getLeaderboard({});
    expect(result).toHaveLength(1);
    expect(result[0].successRate).toBe(0);
    expect(result[0].successfulRuns).toBe(0);
    expect(result[0].failedRuns).toBe(1);
  });

  it('should handle a single agent (single-entry leaderboard)', async () => {
    const singleAgent = createMockRepository([
      createMockRunResult({ agentId: agentA, metrics: { success: true, cost: 1, latency: 10, eScore: 0.5 } }),
      createMockRunResult({ agentId: agentA, metrics: { success: false, cost: 2, latency: 20, eScore: 0.0 } }),
    ]);
    const reporter = new LeaderboardReporter(singleAgent);
    const result = await reporter.getLeaderboard({});
    expect(result).toHaveLength(1);
    expect(result[0].agentId).toBe(agentA);
    expect(result[0].totalRuns).toBe(2);
    expect(result[0].successRate).toBeCloseTo(0.5);
  });
});
