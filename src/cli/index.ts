import { initDatabase } from '../infrastructure/persistence/database.js';
import { CandidateRepository } from '../core/repositories/candidate-repository.js';
import { JsonlDatasetExporter } from '../infrastructure/jsonl-dataset-exporter.js';
import { JsonlDatasetImporter } from '../infrastructure/jsonl-dataset-importer.js';
import { registerEvaluateCommand } from './evaluate.js';
console.log('DEBUG: CLI starting');

import { Command } from 'commander';

const program = new Command();

program
  .name('repobench')
  .description('RepoBench CLI');

program
  .command('export')
  .argument('<path>', 'Path to export to')
  .action(async (path) => {
    console.log('DEBUG: Action started');
    try {
      console.log('DEBUG: Initializing database');
      initDatabase();
      console.log('DEBUG: Creating repo');
      const repo = new CandidateRepository();
      console.log('DEBUG: Creating exporter');
      const exporter = new JsonlDatasetExporter(repo);
      console.log('DEBUG: Exporting');
      const count = await exporter.export(path);
      console.log(`Export successful: ${count} candidate(s) processed`);
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('import')
  .argument('<path>', 'Path to import from')
  .action(async (path) => {
    try {
      initDatabase();
      const repo = new CandidateRepository();
      const importer = new JsonlDatasetImporter(repo);
      const count = await importer.import(path);
      console.log(`Import successful: ${count} candidate(s) processed`);
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

registerEvaluateCommand(program);

program.parseAsync(process.argv).catch(() => {
  process.exit(1);
});

