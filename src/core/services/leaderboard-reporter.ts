import {
  IRunResultRepository,
  RunResult,
  LeaderboardOptions,
  LeaderboardOptionsSchema,
  LeaderboardEntry,
  ILeaderboardReporter,
} from '../contracts';

const sortFieldMap: Record<string, (e: LeaderboardEntry) => number> = {
  eScore: e => e.avgEScore,
  successRate: e => e.successRate,
  cost: e => e.avgCost,
  latency: e => e.avgLatency,
  runs: e => e.totalRuns,
};

export class LeaderboardReporter implements ILeaderboardReporter {
  constructor(private readonly repository: IRunResultRepository) {}

  getLeaderboard(options: LeaderboardOptions): Promise<LeaderboardEntry[]> {
    const opts = LeaderboardOptionsSchema.parse(options);

    let results = this.repository.getAll();

    if (opts.agentId) {
      results = results.filter(r => r.agentId === opts.agentId);
    }

    if (opts.candidateId) {
      results = results.filter(r => r.candidateId === opts.candidateId);
    }

    if (results.length === 0) {
      return Promise.resolve([]);
    }

    const grouped = new Map<string, RunResult[]>();
    for (const r of results) {
      const group = grouped.get(r.agentId);
      if (group) {
        group.push(r);
      } else {
        grouped.set(r.agentId, [r]);
      }
    }

    const entries: LeaderboardEntry[] = [];
    for (const [agentId, runs] of grouped) {
      const totalRuns = runs.length;
      const successfulRuns = runs.filter(r => r.metrics.success).length;
      const failedRuns = totalRuns - successfulRuns;
      const successRate = totalRuns > 0 ? successfulRuns / totalRuns : 0;
      const avgEScore = runs.reduce((sum, r) => sum + r.metrics.eScore, 0) / totalRuns;
      const avgCost = runs.reduce((sum, r) => sum + r.metrics.cost, 0) / totalRuns;
      const avgLatency = runs.reduce((sum, r) => sum + r.metrics.latency, 0) / totalRuns;

      entries.push({
        rank: 0,
        agentId,
        totalRuns,
        successfulRuns,
        failedRuns,
        successRate,
        avgEScore,
        avgCost,
        avgLatency,
      });
    }

    const getValue = sortFieldMap[opts.sortBy];
    entries.sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      return opts.sortOrder === 'desc' ? vb - va : va - vb;
    });

    entries.forEach((e, i) => {
      e.rank = i + 1;
    });

    return Promise.resolve(entries.slice(0, opts.limit));
  }
}
