import { Command } from 'commander';
import { 
  BatchConfig, 
  BatchConfigSchema, 
  SandboxConfig,
  Candidate
} from '../core/contracts';
import { BatchRunnerService } from '../core/services/batch-runner';
import { AgentConfigLoader } from '../core/services/agent-config-loader';
import { initDatabase } from '../infrastructure/database';
import { db } from '../infrastructure/persistence/database';
import { CandidateRepository } from '../core/repositories/candidate-repository';
import { RunResultRepository } from '../core/repositories/run-result-repository';
import { Sandbox } from '../infrastructure/sandbox';
import { Evaluator } from '../core/services/evaluator';
import { JudgeService } from '../core/services/judge-service';
import { FailureArtifactExporter } from '../infrastructure/failure-artifact-exporter';
import { SessionOrchestrator } from '../core/services/session-orchestrator';
import { WorkerPool } from '../infrastructure/services/worker-pool';
import { BatchProgressReporter } from '../core/services/batch-progress-reporter';
import { loadConfig, RepoBenchConfig } from '../core/config';

export function registerRunAllCommand(program: Command): void {
  program
    .command('run-all')
    .description('Run batch evaluation for multiple agents across candidates')
    .option('-a, --agents <ids>', 'Comma-separated list of agent IDs')
    .option('-c, --concurrency <number>', 'Max concurrent runs', (val) => parseInt(val, 10), 2)
    .option('-p, --project <name>', 'Project name for sandbox config', 'default')
    .option('--candidate-ids <ids>', 'Comma-separated list of specific candidate UUIDs')
    .option('--timeout <ms>', 'Per-pair timeout in ms', (val) => parseInt(val, 10), 300000)
    .option('--dry-run', 'Validate config and print planned matrix, then exit')
    .action(async (options: {
      agents?: string;
      concurrency?: number;
      project?: string;
      candidateIds?: string;
      timeout?: number;
      dryRun?: boolean;
    }) => {
      try {
        if (!options.agents) {
          console.error('error: required option \'-a, --agents <ids>\' not specified');
          process.exit(1);
        }
        const agentIds = options.agents.split(',');
        const candidateIds = options.candidateIds ? options.candidateIds.split(',') : [];
        
        const loader = new AgentConfigLoader('./agents.yaml');
        const allAgents = loader.loadConfigs();
        const agents = Array.isArray(allAgents) ? allAgents.filter(a => agentIds.includes(a.agentId)) : [];

        const config: BatchConfig = BatchConfigSchema.parse({
          agentIds,
          candidateIds,
          concurrency: options.concurrency,
          timeoutPerRun: options.timeout,
          dryRun: !!options.dryRun,
        });

        if (config.dryRun) {
          const candidateRepo = new CandidateRepository();
          const candidates = config.candidateIds 

            ? config.candidateIds.map(id => candidateRepo.getById(id)).filter((c): c is Candidate => !!c)
            : candidateRepo.getAll().filter(c => c.status === 'validated' || c.status === 'pending');

          console.log('\nPlanned run matrix:');
          console.log('-------------------');
          for (const agent of agents) {
            console.log(`Agent: ${agent.agentId}`);
            for (const candidate of candidates) {
              console.log(`  - Candidate: ${candidate.id} (${candidate.hash.substring(0, 7)})`);
            }
          }
          console.log('-------------------\n');
          process.exit(0);
        }

        initDatabase();

        let loadedConfig: RepoBenchConfig | undefined;
        try {
          loadedConfig = await loadConfig('repobench.yaml');
        } catch {
          console.warn('Warning: Could not load repobench.yaml, using defaults for sandbox config');
        }

        const candidateRepo = new CandidateRepository();
        const runResultRepo = new RunResultRepository(db);
        const sandboxConfig: SandboxConfig = {
          project: options.project ?? 'default',
          buildCommand: loadedConfig?.sandbox?.buildCommand,
          testCommand: loadedConfig?.sandbox?.testCommand,
          baseImage: loadedConfig?.sandbox?.baseImage,
          envVars: loadedConfig?.sandbox?.envVars,
          agentSetupCommands: loadedConfig?.sandbox?.agentSetupCommands,
          cachePaths: loadedConfig?.sandbox?.cachePaths,
        };
        
        const reporter = new BatchProgressReporter();
        const workerPool = new WorkerPool(config.concurrency);
        
        const batchRunner = new BatchRunnerService(
          workerPool,
          () => new SessionOrchestrator(),
          (sandbox) => {
            const failureArtifactExporter = new FailureArtifactExporter(runResultRepo, candidateRepo, sandbox);
            return new JudgeService(
              sandbox,
              sandboxConfig,
              new Evaluator(sandbox, sandboxConfig),
              runResultRepo,
              failureArtifactExporter
            );
          },
          () => new Sandbox(sandboxConfig),
          candidateRepo,
          agents,
          config,
          reporter
        );

        const summary = await batchRunner.runAll(config);
        
        const exitCode = summary?.failedRuns === 0 ? 0 : 1;
        try {
          process.exit(exitCode);
        } catch (e) {
          const error = e as Error;
          if (error.message !== 'process.exit') throw error;
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
