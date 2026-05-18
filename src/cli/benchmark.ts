import { Command } from 'commander';
import { BenchmarkService } from '../core/services/benchmark-service';
import { Sandbox } from '../infrastructure/sandbox';
import { SandboxConfig } from '../core/contracts';

const program = new Command();

program
  .command('benchmark')
  .description('Run sandbox initialization benchmark')
  .option('-p, --project <name>', 'Project name', 'default')
  .action(async (options) => {
    const config: SandboxConfig = {
      project: options.project,
      baseImage: 'node:20-alpine',
      buildCommand: 'echo "building..."',
    };

    const benchmarkService = new BenchmarkService(Sandbox);
    const results = await benchmarkService.runBenchmark(config);

    console.log('Benchmark Results:');
    console.log(`Cold Start Time: ${results.coldStart.toFixed(2)}ms`);
    console.log(`Warm Start Time: ${results.warmStart.toFixed(2)}ms`);
    console.log(`Cache Hit Ratio: ${(results.hitRatio * 100).toFixed(2)}%`);
  });

program.parse(process.argv);
