import { Command } from 'commander';
import { initDatabase, db } from '../infrastructure/persistence/database.js';
import { RunResultRepository } from '../core/repositories/run-result-repository.js';
import { LeaderboardReporter } from '../core/services/leaderboard-reporter.js';
import { TerminalReportRenderer } from '../core/services/report-renderer.js';
import type { LeaderboardOptions } from '../core/contracts.js';

export function registerReportCommand(program: Command): void {
  program
    .command('report')
    .description('Generate leaderboard report')
    .option('-s, --sort-by <column>', 'Sort column (eScore, successRate, cost, latency, runs)', 'eScore')
    .option('-o, --order <direction>', 'Sort order (asc | desc)', 'desc')
    .option('-l, --limit <number>', 'Max leaderboard entries', (val: string) => parseInt(val, 10), 10)
    .option('-a, --agent-id <id>', 'Filter to specific agent')
    .option('-c, --candidate-id <uuid>', 'Filter to specific candidate')
    .action(async (options: {
      sortBy?: string;
      order?: string;
      limit?: number;
      agentId?: string;
      candidateId?: string;
    }) => {
      try {
        initDatabase();
        const repository = new RunResultRepository(db);
        const reporter = new LeaderboardReporter(repository);
        const renderer = new TerminalReportRenderer();

        const leaderboardOptions: LeaderboardOptions = {
          sortBy: (options.sortBy ?? 'eScore') as LeaderboardOptions['sortBy'],
          sortOrder: (options.order ?? 'desc') as 'asc' | 'desc',
          limit: options.limit ?? 10,
          agentId: options.agentId,
          candidateId: options.candidateId,
        };

        const entries = await reporter.getLeaderboard(leaderboardOptions);
        const rendered = renderer.render(entries);
        console.log(rendered);
        try {
          process.exit(0);
        } catch (e) {
          const exitError = e as Error;
          if (exitError.message !== 'process.exit') throw exitError;
        }
      } catch (error) {
        const err = error as Error;
        console.error(`Error: ${err.message}`);
        try {
          process.exit(1);
        } catch (e) {
          const exitError = e as Error;
          if (exitError.message !== 'process.exit') throw exitError;
        }
      }
    });
}
