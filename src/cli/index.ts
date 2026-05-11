import 'dotenv/config';
import { Command } from 'commander';
import { Miner } from '../core/miner.js';
import { Config } from '../core/config.js';
import { SqliteCandidateRepository } from '../core/repositories/candidate-repo.js';
import { LLMClient } from '../core/llm/client.js';
import { CurationService } from '../core/curation/service.js';
import simpleGit from 'simple-git';

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
      const repo = new SqliteCandidateRepository();
      const llmClient = new LLMClient(config);
      const curationService = new CurationService(llmClient, repo, simpleGit(path));
      const miner = new Miner(path, config, repo, curationService);
      const candidates = await miner.mineCommits();
      console.log(`\\nFound ${candidates.length} high-value candidates:`);
      console.table(candidates);
    } catch (e) {
      console.error('Error mining repository:', e);
      process.exit(1);
    }
  });

program
  .command('list-candidates')
  .description('List persisted commit candidates')
  .option('-s, --status <status>', 'Filter candidates by status')
  .action(async (options) => {
    try {
      const repo = new SqliteCandidateRepository();
      const candidates = options.status 
        ? await repo.findByStatus(options.status)
        : await repo.findAll();
      
      if (candidates.length === 0) {
        console.log('No candidates found.');
        return;
      }
      
      const tableData = candidates.map(c => ({
        Hash: c.hash,
        Message: c.message,
        Status: c.status
      }));
      
      console.table(tableData);
    } catch (e) {
      console.error('Error listing candidates:', e);
      process.exit(1);
    }
  });

program
  .command('curate')
  .description('Curate mined candidates using an LLM')
  .option('-l, --limit <number>', 'Limit the number of validated candidates', '10')
  .action(async (options) => {
    try {
      const config = Config.load();
      const repo = new SqliteCandidateRepository();
      const llmClient = new LLMClient(config);
      const curationService = new CurationService(llmClient, repo, simpleGit('.'));
      const limit = parseInt(options.limit, 10);
      
      console.log(`Curating candidates (limit: ${limit})...`);
      const validated = await curationService.curate(limit);
      
      if (validated.length === 0) {
        console.log('No candidates were validated.');
        return;
      }
      
      console.log(`Successfully validated ${validated.length} candidates:`);
      console.table(validated.map(c => ({ Hash: c.hash, Message: c.message })));
    } catch (e) {
      console.error('Error curating candidates:', e);
      process.exit(1);
    }
  });


program.parse();

