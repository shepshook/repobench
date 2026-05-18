import { describe, it, expect, beforeEach } from 'vitest';
import { VolumeManager } from '../../src/infrastructure/volume-manager';
import { MockDocker } from '../mocks/docker.mock';

describe('VolumeManager Cache Lifecycle', () => {
  let mockDocker: MockDocker;
  let vm: VolumeManager;

  beforeEach(() => {
    mockDocker = new MockDocker();
    vm = new VolumeManager(mockDocker);
    VolumeManager.resetStats();
  });

  it('should correctly track MISS on first setup and HIT on subsequent setups', async () => {
    const project = 'lifecycle-project';
    const cacheVolumes = ['/tmp/cache'];

    // First setup: Expect MISS
    mockDocker.setupCreateVolumeSuccess(); 
    await vm.setupCacheVolumes(cacheVolumes, project);
    
    let stats = await vm.getCacheStats();
    expect(stats.misses).toBe(1);
    expect(stats.hits).toBe(0);

    // Second setup: Expect HIT
    mockDocker.setupCreateVolumeAlreadyExists();
    await vm.setupCacheVolumes(cacheVolumes, project);

    stats = await vm.getCacheStats();
    expect(stats.misses).toBe(1);
    expect(stats.hits).toBe(1);
  });

  it('should correctly track HIT when recordCacheStatus is called after setup', async () => {
    const project = 'record-project';
    const cacheVolumes = ['/tmp/cache'];

    // Setup: MISS
    mockDocker.setupCreateVolumeSuccess();
    await vm.setupCacheVolumes(cacheVolumes, project);

    // Record: HIT
    mockDocker.setupCreateVolumeAlreadyExists();
    await vm.recordCacheStatus(project);

    const stats = await vm.getCacheStats();
    expect(stats.misses).toBe(1);
    expect(stats.hits).toBe(1);
  });

  it('should not count a hit if the volume was not previously created', async () => {
    const project = 'no-prev-project';
    
    // Record status without setup: Should probably be a MISS or throw, 
    // but let's see how it behaves. 
    // If it's a HIT, it's a bug.
    mockDocker.setupCreateVolumeSuccess(); // Docker says it can create it (meaning it doesn't exist)
    await vm.recordCacheStatus(project);

    const stats = await vm.getCacheStats();
    expect(stats.hits).toBe(0);
  });
});
