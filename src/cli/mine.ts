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
    .action(async (options) => {
      try {
        const originalCwd = process.cwd();
        
        if (options.repo) {
          process.chdir(options.repo);
        }

        const config = await loadConfig(options.config);
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

  await program.parseAsync(process.argv);
}

if (process.argv[1]?.endsWith('mine.ts') || process.argv[1]?.endsWith('mine.js')) {
  main();
}
