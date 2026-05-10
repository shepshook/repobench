import { Command } from 'commander';
import { Miner } from '../core/miner.js';
import { Config } from '../core/config.js';

const program = new Command();

program
  .name('repobench')
  .description('Benchmark AI coding agents on your private repo')
  .version('0.1.0');

program
  .command('mine')
  .description('Mine a repository for potential bug-fix candidates')
  .argument('<path>', 'Path to the git repository')
  .action(async (path) => {
    try {
      const config = Config.load();
      const miner = new Miner(path, config);
      const candidates = await miner.mineCommits();
      console.log(`\\nFound ${candidates.length} high-value candidates:`);
      console.table(candidates);
    } catch (e) {
      console.error('Error mining repository:', e);
      process.exit(1);
    }
  });

program.parse();

