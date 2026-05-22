import { Command } from 'commander';
import { initDatabase } from '../infrastructure/database.js';
import { db } from '../infrastructure/persistence/database.js';
import { CandidateRepository } from '../core/repositories/candidate-repository.js';
import { RunResultRepository } from '../core/repositories/run-result-repository.js';
import { FailureArtifactExporter } from '../infrastructure/failure-artifact-exporter.js';

export function registerExportFailuresCommand(program: Command): void {
  program
    .command('export-failures')
    .description('Export failure artifacts (diff, logs, ground truth) for failed runs')
    .option('-o, --output-dir <path>', 'output directory', 'exports')
    .option('--run-id <uuid>', 'export artifacts for a single run')
    .action(async (options: { outputDir: string; runId?: string }) => {
      try {
        initDatabase();
        const candidateRepo = new CandidateRepository();
        const runResultRepo = new RunResultRepository(db);
        const exporter = new FailureArtifactExporter(runResultRepo, candidateRepo);

        const exportOpts = { outputDir: options.outputDir };

        if (options.runId) {
          const artifact = await exporter.exportForRun(options.runId, exportOpts);
          console.log(`Exported artifacts for run ${options.runId}:`);
          console.log(`  ${artifact.diffPatchPath}`);
          console.log(`  ${artifact.sessionLogPath}`);
          console.log(`  ${artifact.groundTruthPath}`);
        } else {
          const artifacts = await exporter.exportAllFailures(exportOpts);
          console.log(`Exported ${artifacts.length} failed run(s)`);
          for (const a of artifacts) {
            console.log(`  Run ${a.runId}:`);
            console.log(`    ${a.diffPatchPath}`);
            console.log(`    ${a.sessionLogPath}`);
            console.log(`    ${a.groundTruthPath}`);
          }
        }

        process.exit(0);
      } catch (error: unknown) {
        console.error(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}
