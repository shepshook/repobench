import { Database } from '../infrastructure/persistence/database.js';
import { loadConfig, RepoBenchConfig, resolveDatabasePath } from '../core/config.js';
import { CandidateRepository } from '../core/repositories/candidate-repository.js';
import { JsonlDatasetExporter } from '../infrastructure/jsonl-dataset-exporter.js';
import { JsonlDatasetImporter } from '../infrastructure/jsonl-dataset-importer.js';
import { registerEvaluateCommand } from './evaluate.js';
import { registerRunAllCommand } from './run-all.js';
import { registerReportCommand } from './report.js';
import { registerExportFailuresCommand } from './export-failures.js';
import { registerMineCommand } from './mine.js';
import { registerBenchmarkCommand } from './benchmark.js';
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
      let config: RepoBenchConfig | undefined;
      try {
        config = await loadConfig();
      } catch {
        // config is optional; fall back to default database path
        console.warn('Warning: Could not load config, using default database path');
      }
      Database.init({ dbPath: resolveDatabasePath(config?.database?.path) });
      console.log('DEBUG: Creating repo');
      const repo = new CandidateRepository();
      console.log('DEBUG: Creating exporter');
      const exporter = new JsonlDatasetExporter(repo);
      console.log('DEBUG: Exporting');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const count = await exporter.export(path);
      console.log(`Export successful: ${count} candidate(s) processed`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('import')
  .argument('<path>', 'Path to import from')
    .action(async (path) => {
      try {
        let config: RepoBenchConfig | undefined;
        try {
          config = await loadConfig();
        } catch {
          // config is optional; fall back to default database path
          console.warn('Warning: Could not load config, using default database path');
        }
        Database.init({ dbPath: resolveDatabasePath(config?.database?.path) });
        const repo = new CandidateRepository();
      const importer = new JsonlDatasetImporter(repo);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const count = await importer.import(path);
      console.log(`Import successful: ${count} candidate(s) processed`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

registerMineCommand(program);
registerBenchmarkCommand(program);
registerEvaluateCommand(program);
registerRunAllCommand(program);
registerReportCommand(program);
registerExportFailuresCommand(program);

import { registerAllAdapters } from '../infrastructure/agents/register-adapters.js';

registerAllAdapters();

program.parseAsync(process.argv).catch(() => {
  process.exit(1);
});

