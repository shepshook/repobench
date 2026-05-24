import { Command } from 'commander';
import { loadConfig } from '../core/config.js';
import { GitMiner } from '../core/services/miner.js';
import { CandidateRepository } from '../core/repositories/candidate-repository.js';
import { initDatabase } from '../infrastructure/persistence/database.js';
import process from 'node:process';

export async function main() {
  const program = new Command();

  program
    .name('repobench-mine')
    .description('Mine bug-fix candidates from git history')
    .option('-c, --config <path>', 'path to config file', 'repobench.yaml')
    .option('-r, --repo <path>', 'path to git repository')
    .option('--since <date>', 'minimum date for commits (ISO-8601)')
    .action(async (options) => {
      try {
        const originalCwd = process.cwd();
        
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (options.repo) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
          process.chdir(options.repo);
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        const config = await loadConfig(options.config);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (options.since !== undefined) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(options.since as string)) {
            console.error('Error: Invalid --since date format. Expected ISO-8601 datetime (e.g., 2024-01-01T00:00:00Z).');
            process.exit(1);
          }
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          config.mining.since = options.since;
        }

        initDatabase();
        const repository = new CandidateRepository();
        const miner = new GitMiner(repository);
        const candidates = await miner.mineCommits(config);
        
        console.log(`Found ${candidates.length} candidates.`);
        
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (options.repo) {
          process.chdir(originalCwd);
        }
      } catch (error: unknown) {
        console.error(`Error during mining: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  await program.parseAsync(process.argv);
}

export function registerMineCommand(program: Command): void {
  program
    .command('mine')
    .description('Mine bug-fix candidates from git history')
    .option('-c, --config <path>', 'path to config file', 'repobench.yaml')
    .option('-r, --repo <path>', 'path to git repository')
    .option('--since <date>', 'minimum date for commits (ISO-8601)')
    .action(async (options: { config?: string; repo?: string; since?: string }) => {
      try {
        const originalCwd = process.cwd();

        if (options.repo) {
          process.chdir(options.repo);
        }

        const config = await loadConfig(options.config ?? 'repobench.yaml');

        if (options.since !== undefined) {
          if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(options.since)) {
            console.error('Error: Invalid --since date format. Expected ISO-8601 datetime (e.g., 2024-01-01T00:00:00Z).');
            process.exit(1);
          }
          config.mining.since = options.since;
        }

        initDatabase();
        const repository = new CandidateRepository();
        const miner = new GitMiner(repository);
        const candidates = await miner.mineCommits(config);

        console.log(`Found ${candidates.length} candidates.`);

        if (options.repo) {
          process.chdir(originalCwd);
        }
      } catch (error: unknown) {
        console.error(`Error during mining: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}

if (process.argv[1]?.endsWith('mine.ts') || process.argv[1]?.endsWith('mine.js')) {
  void main();
}
