import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { VolumeManager } from '../../src/infrastructure/volume-manager';

vi.mock('../../src/infrastructure/volume-manager');
vi.mock('dockerode');

describe('Sandbox', () => {
  let sandbox: Sandbox;
  let mockVolumeManager: VolumeManager;
  const config = {
    baseImage: 'node:20-alpine',
    project: 'test-project',
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockVolumeManager = new VolumeManager({} as any);
    sandbox = new Sandbox(config, mockVolumeManager);
  });

  it('should throw "Sandbox not initialized" when createSnapshot is called before init', async () => {
    await expect(sandbox.createSnapshot()).rejects.toThrow('Sandbox not initialized');
  });

  it('should throw "Sandbox not initialized" when execute is called before init', async () => {
    await expect(sandbox.execute('ls')).rejects.toThrow('Sandbox not initialized');
  });

  it('should throw "Sandbox not initialized" when restoreSnapshot is called before init', async () => {
    await expect(sandbox.restoreSnapshot()).rejects.toThrow('Sandbox not initialized');
  });

  it('should not throw if init has been called (simulation mode)', async () => {
    // Mock VolumeManager.setupCacheVolumes to simulate Docker failure and trigger simulation
    (mockVolumeManager.setupCacheVolumes as any).mockRejectedValue(new Error('docker_engine not found'));
    
    await sandbox.init();
    expect(sandbox.isSimulation).toBe(true);
    
    // Should not throw now
    await expect(sandbox.createSnapshot()).resolves.not.toThrow();
  });
});
