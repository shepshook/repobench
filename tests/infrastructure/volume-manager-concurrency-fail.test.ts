import { describe, it, expect } from 'vitest';
import { VolumeManager } from '../../src/infrastructure/volume-manager';
import { MockDocker } from '../mocks/docker.mock';

describe('VolumeManager Concurrency', () => {
  it('should only create the Docker volume once even with concurrent requests', async () => {
    const mockDocker = new MockDocker();
    mockDocker.setupCreateVolumeSuccess();
    const vm = new VolumeManager(mockDocker);
    const volumeName = 'concurrent-volume';
    
    // Trigger multiple creations simultaneously
    await Promise.all([
      vm.createVolume(volumeName),
      vm.createVolume(volumeName),
      vm.createVolume(volumeName)
    ]);
    
    // If it were robustly concurrency-safe, it should only call docker.createVolume once.
    expect(mockDocker.createVolumeMock).toHaveBeenCalledTimes(1);
  });
});
