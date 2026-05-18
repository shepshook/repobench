import { describe, it, expect, vi } from 'vitest';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { IVolumeManager } from '../../src/core/contracts';

describe('Sandbox Docker Fallback', () => {
  it('should fallback to simulation mode when Docker is unavailable (ENOENT)', async () => {
    const mockVolumeManager: IVolumeManager = {
      calculateCacheKey: vi.fn(),
      setupCacheVolumes: vi.fn(),
      recordCacheStatus: vi.fn(),
      getVolumes: vi.fn().mockReturnValue({}),
      createVolume: vi.fn(),
      mountVolume: vi.fn(),
      removeVolume: vi.fn(),
      resetStats: vi.fn(),
      getDocker: vi.fn().mockImplementation(() => {
        throw { code: 'ENOENT', message: 'docker_engine not found' };
      }),
      getCacheStats: vi.fn(),
      simCacheRoot: '/tmp/sim-cache'
    };

    const config = {
      project: 'fallback-test'
    };

    const sandbox = new Sandbox(config, mockVolumeManager);
    
    // We need to mock initDocker as it calls getDocker().getImage()
    // Since we can't mock private methods easily, we rely on the fact that 
    // Sandbox.init() catches the error from initDocker().
    
    await sandbox.init();

    // Check if resetStats was called (indicating fallback path was taken)
    expect(mockVolumeManager.resetStats).toHaveBeenCalled();
    
    // To check if isSimulation is true, we can try to execute a command 
    // and see if it uses the simulation logic (e.g. a mocked command)
    const result = await sandbox.execute('echo "Hello Simulation"');
    expect(result.stdout).toContain('Hello Simulation');
  });
});
