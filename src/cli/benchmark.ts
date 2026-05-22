import { Command } from 'commander';
import { BenchmarkService } from '../core/services/benchmark-service';
import { Sandbox } from '../infrastructure/sandbox';
import { VolumeManager } from '../infrastructure/volume-manager';
import { SandboxConfig, IDocker } from '../core/contracts';
import Docker from 'dockerode';

export function registerBenchmarkCommand(program: Command): void {
  program
    .command('benchmark')
    .description('Run sandbox initialization benchmark')
    .option('-p, --project <name>', 'Project name', 'default')
    .action(async (options) => {
      const config: SandboxConfig = {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        project: options.project,
        baseImage: 'node:20-alpine',
        buildCommand: 'echo "building..."',
      };

      const volumeManager = new VolumeManager(new Docker() as unknown as IDocker);
      const benchmarkService = new BenchmarkService(Sandbox, volumeManager);
      const results = await benchmarkService.runBenchmark(config);

      console.log('Benchmark Results:');
      console.log(`Cold Start Time: ${results.coldStart.toFixed(2)}ms`);
      console.log(`Warm Start Time: ${results.warmStart.toFixed(2)}ms`);
      console.log(`Cache Hit Ratio: ${(results.hitRatio * 100).toFixed(2)}%`);
    });
}
