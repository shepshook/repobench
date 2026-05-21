import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
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
    .option('-c, --cost <number>', 'Default cost for all candidates')
    .option('--cost-file <path>', 'JSON file with candidate costs')
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

        let costMap: Map<string, number> | undefined;
        if (options.costFile) {
          const filePath = path.resolve(options.costFile);
          const costData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          costMap = new Map(Object.entries(costData).map(([id, cost]) => [id, Number(cost)]));
        } else if (options.cost) {
          const defaultCost = Number(options.cost);
          costMap = new Map(candidates.map(c => [c.id, defaultCost]));
        } else {
          console.warn('Warning: No cost data provided. Using default cost of 1 for all candidates.');
        }

        const sandboxConfig: SandboxConfig = { project: options.project };
        const sandbox = new Sandbox(sandboxConfig);
        await sandbox.init();

        const evaluator = new Evaluator(sandbox, sandboxConfig);
        const judgeService = new JudgeService(sandbox, sandboxConfig, evaluator);

        const results = await judgeService.runEvaluationPipeline(candidates, costMap);

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
