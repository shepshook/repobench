import { Command } from 'commander';
import { initDatabase } from '../infrastructure/persistence/database.js';
import { CandidateRepository } from '../core/repositories/candidate-repository.js';
import { Sandbox } from '../infrastructure/sandbox.js';
import { SandboxConfig } from '../core/contracts.js';
import { Evaluator } from '../core/services/evaluator.js';
import { JudgeService } from '../core/services/judge-service.js';

export function registerEvaluateCommand(program: Command): void {
  program
    .command('evaluate')
    .description('Run evaluation pipeline on validated candidates')
    .option('-p, --project <name>', 'Project name', 'default')
    .action(async (options) => {
      try {
        initDatabase();
        const repo = new CandidateRepository();
        const allCandidates = repo.getAll();
        const candidates = allCandidates.filter(c => c.status === 'validated');

        if (candidates.length === 0) {
          console.log('No validated candidates found to evaluate.');
          return;
        }

        const sandboxConfig: SandboxConfig = { project: options.project };
        const sandbox = new Sandbox(sandboxConfig);
        await sandbox.init();

        const evaluator = new Evaluator(sandbox, sandboxConfig);
        const judgeService = new JudgeService(sandbox, sandboxConfig, evaluator);

        const results = await judgeService.runEvaluationPipeline(candidates);

        console.log(`Evaluation complete: ${results.length} candidate(s) processed.`);
        for (const r of results) {
          console.log(`  ${r.candidateId}: ${r.result.regressionStatus} - ${r.result.message}`);
        }

        await sandbox.destroy();
      } catch (error: unknown) {
        console.error(`Evaluation error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}
