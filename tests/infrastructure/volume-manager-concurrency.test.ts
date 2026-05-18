import { describe, it, expect } from 'vitest';
import { VolumeManager } from '../../src/infrastructure/volume-manager';
import { MockDocker } from '../mocks/docker.mock';

describe('VolumeManager Concurrency', () => {
  it('should actually create a volume', async () => {
    const mockDocker = new MockDocker();
    mockDocker.setupCreateVolumeSuccess();
    const vm = new VolumeManager(mockDocker);
    const volumeName = 'test-volume';
    
    await vm.createVolume(volumeName);
    
    // VolumeManager doesn't add to cacheVolumes in createVolume, it does it in mountVolume
    expect(mockDocker.createVolumeMock).toHaveBeenCalledWith(expect.objectContaining({ Name: volumeName }));
  });
});
