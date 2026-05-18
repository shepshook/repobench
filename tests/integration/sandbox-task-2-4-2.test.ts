import { describe, it, expect, vi } from 'vitest';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { SandboxConfig, IVolumeManager } from '../../src/core/contracts';

describe('Sandbox Task 2.4.2 Integration', () => {
  it('should use setupCacheVolumes when initializing Sandbox with cacheVolumes', async () => {
    const config: SandboxConfig = {
      project: 'test-project',
      cacheVolumes: [
        { hostPath: '/host/path', containerPath: '/container/path' }
      ]
    };
    
    const mockVolumeManager = {
      setupCacheVolumes: vi.fn().mockResolvedValue(true),
      getCacheStats: vi.fn().mockResolvedValue({ hits: 0, misses: 0 }),
      getVolumes: vi.fn().mockReturnValue({}),
      getDocker: vi.fn().mockReturnValue({
        pull: vi.fn().mockResolvedValue({}),
        getImage: vi.fn().mockReturnValue({
          inspect: vi.fn().mockResolvedValue({}),
        }),
        createContainer: vi.fn().mockResolvedValue({
          start: vi.fn().mockResolvedValue({}),
        }),
      }),
    } as unknown as IVolumeManager;

    const sandbox = new Sandbox(config, mockVolumeManager);
    
    await sandbox.init();
    
    expect(mockVolumeManager.setupCacheVolumes).toHaveBeenCalledWith(
      config.cacheVolumes,
      config.project,
      expect.any(String),
      false
    );
  });
});
