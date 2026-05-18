import { describe, it, expect, beforeEach } from 'vitest';
import { VolumeManager } from '../../src/infrastructure/volume-manager';
import Docker from 'dockerode';

describe('VolumeManager Cache Stats', () => {
  let volumeManager: VolumeManager;

  beforeEach(() => {
    volumeManager = new VolumeManager(new Docker());
    VolumeManager.resetStats();
  });

  it('should start with zero stats', async () => {
    const stats = await volumeManager.getCacheStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
  });

  it('should correctly increment misses on first setup', async () => {
    // Using simulation to avoid actual Docker dependency for this unit test
    await volumeManager.setupCacheVolumes(['/tmp/cache'], 'test-project', undefined, true);
    const stats = await volumeManager.getCacheStats();
    expect(stats.misses).toBe(1);
    expect(stats.hits).toBe(0);
  });

  it('should correctly increment hits on second setup of same volume', async () => {
    await volumeManager.setupCacheVolumes(['/tmp/cache'], 'test-project', undefined, true);
    await volumeManager.setupCacheVolumes(['/tmp/cache'], 'test-project', undefined, true);
    const stats = await volumeManager.getCacheStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
  });

  it('should reset stats correctly', async () => {
    await volumeManager.setupCacheVolumes(['/tmp/cache'], 'test-project', undefined, true);
    volumeManager.resetStats();
    const stats = await volumeManager.getCacheStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
  });
});
