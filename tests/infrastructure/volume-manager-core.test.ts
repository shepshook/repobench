import { describe, it, expect, beforeEach } from 'vitest';
import { VolumeManager, VolumeManagerError } from '../../src/infrastructure/volume-manager';
import { MockDocker } from '../mocks/docker.mock';

describe('VolumeManager Core', () => {
  let mockDocker: MockDocker;
  let vm: VolumeManager;

  beforeEach(() => {
    mockDocker = new MockDocker();
    vm = new VolumeManager(mockDocker);
  });

  describe('Dependency Injection (DI)', () => {
    it('should throw if Docker instance is missing (Strict DI Enforcement)', () => {
      // @ts-expect-error: Testing runtime DI enforcement
      expect(() => new VolumeManager(undefined)).toThrow('Docker instance is required');
    });

    it('should work correctly with an injected MockDocker instance', () => {
      expect(vm).toBeDefined();
    });
  });

  describe('Docker Interaction', () => {
    it('should interact with Docker to create a volume', async () => {
      mockDocker.setupCreateVolumeSuccess();
      const volumeName = 'test-volume';
      await vm.createVolume(volumeName);
      expect(mockDocker.createVolumeMock).toHaveBeenCalledWith(expect.objectContaining({ Name: volumeName }));
    });

    it('should create volume with correct labels', async () => {
      mockDocker.setupCreateVolumeSuccess();
      const volumeName = 'test-volume-with-labels';
      await vm.createVolume(volumeName);
      expect(mockDocker.createVolumeMock).toHaveBeenCalledWith(expect.objectContaining({
        Name: volumeName,
        Labels: { app: 'repobench' }
      }));
    });
  });

  describe('Error Handling & RCA (Architecture 4.3)', () => {
    it('should throw a specific VolumeManagerError for Docker failures', async () => {
      mockDocker.setupCreateVolumeError('docker error');
      await expect(vm.createVolume('test-vol')).rejects.toThrow(VolumeManagerError);
    });

    it('should include stdout and stderr context in the error message', async () => {
      const error = new Error('Docker API error');
      (error as any).json = { message: 'unexpected internal error' };
      (error as any).stdout = 'captured stdout info';
      (error as any).stderr = 'captured stderr info';
      mockDocker.createVolumeMock.mockRejectedValue(error);
      
      try {
        await vm.createVolume('test-volume');
        expect.fail('Should have thrown');
      } catch (e: any) {
        expect(e.message).toContain('captured stdout info');
        expect(e.message).toContain('captured stderr info');
        
        if (e instanceof VolumeManagerError) {
          expect(e.context.stdout).toBe('captured stdout info');
          expect(e.context.stderr).toBe('captured stderr info');
        }
      }
    });
  });

  describe('Persistence Logic', () => {
    it('should persist simulation cache across multiple VolumeManager instances', async () => {
      const project = 'persistence-test';
      const lockFile = 'package-lock.json';
      
      // Create first instance and record a miss (simulation mode)
      const vm1 = new VolumeManager(mockDocker);
      await vm1.recordCacheStatus(project, lockFile, true);
      expect((await vm1.getCacheStats()).misses).toBe(1);

      // Create second instance and record a hit (since first one added to simulated cache)
      const vm2 = new VolumeManager(mockDocker);
      await vm2.recordCacheStatus(project, lockFile, true);
      const stats2 = await vm2.getCacheStats();
      
      // Instance-level stats: vm2 sees its own hit
      expect(stats2.misses).toBe(0);
      expect(stats2.hits).toBe(1);
    });
  });
});
