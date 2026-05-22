import { describe, it, expect } from 'vitest';
import {
  LeaderboardOptionsSchema,
  ILeaderboardReporter,
  type LeaderboardEntry,
} from '../../src/core/contracts';

describe('LeaderboardOptionsSchema', () => {
  it('should apply default values when called with empty object', () => {
    const opts = LeaderboardOptionsSchema.parse({});
    expect(opts.sortBy).toBe('eScore');
    expect(opts.sortOrder).toBe('desc');
    expect(opts.limit).toBe(10);
    expect(opts.agentId).toBeUndefined();
    expect(opts.candidateId).toBeUndefined();
  });

  it('should accept explicit valid values for all fields', () => {
    const opts = LeaderboardOptionsSchema.parse({
      sortBy: 'cost',
      sortOrder: 'asc',
      limit: 25,
      agentId: 'agent-xyz',
      candidateId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(opts.sortBy).toBe('cost');
    expect(opts.sortOrder).toBe('asc');
    expect(opts.limit).toBe(25);
    expect(opts.agentId).toBe('agent-xyz');
    expect(opts.candidateId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('should reject an invalid sortBy value', () => {
    // @ts-expect-error - testing runtime validation error
    expect(() => LeaderboardOptionsSchema.parse({ sortBy: 'bogus' })).toThrow();
  });

  it('should reject an invalid sortOrder value', () => {
    // @ts-expect-error - testing runtime validation error
    expect(() => LeaderboardOptionsSchema.parse({ sortOrder: 'sideways' })).toThrow();
  });

  it('should reject a non-positive limit', () => {
    // @ts-expect-error - testing runtime validation error
    expect(() => LeaderboardOptionsSchema.parse({ limit: 0 })).toThrow();
    // @ts-expect-error - testing runtime validation error
    expect(() => LeaderboardOptionsSchema.parse({ limit: -1 })).toThrow();
  });

  it('should reject a non-integer limit', () => {
    // @ts-expect-error - testing runtime validation error
    expect(() => LeaderboardOptionsSchema.parse({ limit: 1.5 })).toThrow();
  });
});

describe('LeaderboardEntry', () => {
  it('should be usable as a type with all required fields', () => {
    const entry: LeaderboardEntry = {
      rank: 1,
      agentId: 'agent-alpha',
      totalRuns: 20,
      successfulRuns: 15,
      failedRuns: 5,
      successRate: 0.75,
      avgEScore: 0.82,
      avgCost: 0.034,
      avgLatency: 1450,
    };
    expect(entry.rank).toBe(1);
    expect(entry.successRate).toBe(0.75);
    expect(entry.totalRuns).toBe(20);
  });
});

describe('ILeaderboardReporter', () => {
  it('should be implementable by a mock class', () => {
    class MockLeaderboardReporter implements ILeaderboardReporter {
      async getLeaderboard(): Promise<LeaderboardEntry[]> {
        return [];
      }
    }
    const reporter: ILeaderboardReporter = new MockLeaderboardReporter();
    expect(reporter).toBeDefined();
  });

  it('should return an empty array when no data exists', async () => {
    class MockLeaderboardReporter implements ILeaderboardReporter {
      async getLeaderboard(): Promise<LeaderboardEntry[]> {
        return [];
      }
    }
    const reporter = new MockLeaderboardReporter();
    const result = await reporter.getLeaderboard({});
    expect(result).toEqual([]);
  });

  it('should accept a LeaderboardOptions parameter', async () => {
    class MockLeaderboardReporter implements ILeaderboardReporter {
      async getLeaderboard(options: {
        sortBy?: string;
        sortOrder?: string;
        limit?: number;
        agentId?: string;
        candidateId?: string;
      }): Promise<LeaderboardEntry[]> {
        return [];
      }
    }
    const reporter = new MockLeaderboardReporter();
    await expect(
      reporter.getLeaderboard({ sortBy: 'eScore', sortOrder: 'desc', limit: 5 }),
    ).resolves.toEqual([]);
  });
});
