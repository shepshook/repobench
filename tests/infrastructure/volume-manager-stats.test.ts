import { describe, it, expect, beforeEach } from 'vitest';
import { VolumeManager } from '../../src/infrastructure/volume-manager';
import { MockDocker } from '../mocks/docker.mock';

describe('VolumeManager Cache Stats', () => {
  let mockDocker: MockDocker;
  let vm: VolumeManager;

  beforeEach(() => {
    mockDocker = new MockDocker();
    vm = new VolumeManager(mockDocker);
    VolumeManager.resetStats();
  });

  describe('Basic Counting & Idempotency', () => {
    it('should count 1 miss on first setup (Cold Start)', async () => {
      mockDocker.setupCreateVolumeSuccess();
      await vm.setupCacheVolumes(['/tmp/cache'], 'project-1');
      const stats = await vm.getCacheStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);
    });

    it('should count 1 hit on second setup of same volume (Warm Start)', async () => {
      mockDocker.setupCreateVolumeSuccess();
      await vm.setupCacheVolumes(['/tmp/cache'], 'project-1');
      
      mockDocker.setupCreateVolumeAlreadyExists();
      await vm.setupCacheVolumes(['/tmp/cache'], 'project-1');
      
      const stats = await vm.getCacheStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(1);
    });

    it('should be idempotent: not increment stats multiple times for the same volume in a single session', async () => {
      mockDocker.setupCreateVolumeSuccess();
      await vm.setupCacheVolumes(['/tmp/cache'], 'project-1'); // Miss
      
      mockDocker.setupCreateVolumeAlreadyExists();
      await vm.setupCacheVolumes(['/tmp/cache'], 'project-1'); // Hit
      await vm.recordCacheStatus('project-1');                // Hit
      
      const stats = await vm.getCacheStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(1);
    });

    it('should not double count when simulation is used', async () => {
      await vm.setupCacheVolumes(['/tmp/cache'], 'sim-project', undefined, true); // MISS
      await vm.recordCacheStatus('sim-project', undefined, true);                // HIT
      
      const stats = await vm.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });
  });

  describe('Isolation & Leaks', () => {
    it('should not leak stats between different VolumeManager instances', async () => {
      const vm1 = new VolumeManager(mockDocker);
      await vm1.setupCacheVolumes(['/tmp/cache'], 'proj1');
      expect((await vm1.getCacheStats()).misses).toBe(1);

      const vm2 = new VolumeManager(mockDocker);
      expect((await vm2.getCacheStats()).misses).toBe(0);
    });

    it('should generate different volume names for different projects', async () => {
      mockDocker.setupCreateVolumeSuccess();
      await vm.setupCacheVolumes(['/tmp/cache'], 'project-a');
      const volumesA = vm.getVolumes();
      
      await vm.setupCacheVolumes(['/tmp/cache'], 'project-b');
      const volumesB = vm.getVolumes();
      
      expect(Object.values(volumesA)[0]).not.toBe(Object.values(volumesB)[0]);
    });
  });

  describe('Error Handling Stats', () => {
    it('should not count as a miss when setupCacheVolumes throws an unexpected error', async () => {
      mockDocker.setupCreateVolumeError(new Error('Unexpected Docker Failure'));
      await expect(vm.setupCacheVolumes(['/tmp/cache'], 'error-project')).rejects.toThrow();
      
      const stats = await vm.getCacheStats();
      expect(stats.misses).toBe(0);
    });

    it('should not count as a miss when recordCacheStatus throws an unexpected error', async () => {
      mockDocker.setupCreateVolumeError(new Error('Unexpected Docker Failure'));
      await expect(vm.recordCacheStatus('error-project')).rejects.toThrow();
      
      const stats = await vm.getCacheStats();
      expect(stats.misses).toBe(0);
    });
  });
});
