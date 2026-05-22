import { IBenchmarkService, SandboxConfig, ISandbox, IVolumeManager } from '../contracts';
import { performance } from 'perf_hooks';

export class BenchmarkService implements IBenchmarkService {
  constructor(
    private SandboxClass: new (config: SandboxConfig, volumeManager?: IVolumeManager) => ISandbox,
    private volumeManager: IVolumeManager,
  ) {}

  async runBenchmark(config: SandboxConfig): Promise<{ coldStart: number, warmStart: number, hitRatio: number }> {
    const volumeManager = this.volumeManager;

    // 1. Cold start
    let sandbox: ISandbox = new this.SandboxClass(config, volumeManager);
    const startCold = performance.now();
    await sandbox.init();
    const endCold = performance.now();
    const coldStart = endCold - startCold;
    
    await sandbox.getCacheStats();
    await sandbox.destroy();

    // 2. Warm start
    sandbox = new this.SandboxClass(config, volumeManager);
    const startWarm = performance.now();
    await sandbox.init();
    const endWarm = performance.now();
    const warmStart = endWarm - startWarm;
    
    const warmStats = await sandbox.getCacheStats();
    await sandbox.destroy();

    // 3. Cache stats (hit ratio)
    const totalRequests = warmStats.hits + warmStats.misses;
    const hitRatio = totalRequests > 0 ? warmStats.hits / totalRequests : 0;

    return { coldStart, warmStart, hitRatio };
  }
}
