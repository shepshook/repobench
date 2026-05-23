import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SandboxManager } from '../../src/infrastructure/sandbox/sandbox-manager';
import { ContainerRepository } from '../../src/core/repositories/container-repository';
import Docker from 'dockerode';
import { SANDBOX_APP_LABEL } from '../../src/core/contracts';

vi.mock('dockerode');
vi.mock('../../src/core/repositories/container-repository');

describe('SandboxManager', () => {
  let sandboxManager: SandboxManager;
  let mockRepo: ContainerRepository;
  let mockDocker: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = new ContainerRepository();
    mockDocker = new Docker();
    sandboxManager = new SandboxManager(mockRepo, mockDocker);
  });

  describe('Container Tracking', () => {
    it('should track a container in the repository', async () => {
      const containerId = 'cont-123';
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          Config: { Image: 'node:20-alpine' },
          State: { Status: 'running' },
          Created: new Date().toISOString(),
        }),
      };
      mockDocker.getContainer = vi.fn().mockReturnValue(mockContainer);
      await sandboxManager.trackContainer(containerId);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          containerId: containerId,
          labels: { app: SANDBOX_APP_LABEL },
        })
      );
    });

    it('should throw a descriptive error when tracking a container fails', async () => {
      const containerId = 'cont-123';
      const dockerError = { message: 'Docker error', stderr: 'Container not found on host' };
      const mockContainer = { inspect: vi.fn().mockRejectedValue(dockerError) };
      mockDocker.getContainer = vi.fn().mockReturnValue(mockContainer);
      await expect(sandboxManager.trackContainer(containerId)).rejects.toThrow(/Container not found on host/);
    });
  });

  describe('Container Lifecycle', () => {
    it('should stop a container and update its status in the repository', async () => {
      const containerId = 'cont-123';
      const mockContainer = { stop: vi.fn().mockResolvedValue({}) };
      mockDocker.getContainer = vi.fn().mockReturnValue(mockContainer);
      mockRepo.getById = vi.fn().mockReturnValue({ containerId, status: 'running' });
      await sandboxManager.stopContainer(containerId);
      expect(mockContainer.stop).toHaveBeenCalled();
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ containerId, status: 'stopped' })
      );
    });

    it('should throw a descriptive error containing stderr when stop fails', async () => {
      const containerId = 'cont-123';
      const dockerError = { message: 'Docker error', stderr: 'Unexpected EOF from server' };
      const mockContainer = { stop: vi.fn().mockRejectedValue(dockerError) };
      mockDocker.getContainer = vi.fn().mockReturnValue(mockContainer);
      await expect(sandboxManager.stopContainer(containerId)).rejects.toThrow(/Unexpected EOF from server/);
    });

    it('should kill containers that exceed the timeout period', async () => {
      const timeoutMs = 60000;
      const now = new Date();
      const oldId = 'old-cont';
      const freshId = 'fresh-cont';
      const oldDate = new Date(now.getTime() - 120000).toISOString();
      const freshDate = new Date(now.getTime() - 10000).toISOString();
      
      mockRepo.getAll = vi.fn().mockReturnValue([
        { containerId: oldId, createdAt: oldDate },
        { containerId: freshId, createdAt: freshDate },
      ]);
      
      const mockOld = { stop: vi.fn().mockResolvedValue({}), remove: vi.fn().mockResolvedValue({}) };
      const mockFresh = { stop: vi.fn().mockResolvedValue({}), remove: vi.fn().mockResolvedValue({}) };
      mockDocker.getContainer = vi.fn().mockImplementation((id) => id === oldId ? mockOld : mockFresh);
      
      await sandboxManager.killTimedOutContainers(timeoutMs);
      expect(mockOld.stop).toHaveBeenCalled();
      expect(mockFresh.stop).not.toHaveBeenCalled();
    });
  });

  describe('Orphaned Container Cleanup', () => {
    it('should cleanup all labeled containers', async () => {
      const mockContainers = [
        {
          Id: 'cont-1',
          inspect: vi.fn().mockResolvedValue({ Config: { Labels: { app: SANDBOX_APP_LABEL } } }),
          stop: vi.fn().mockResolvedValue({}),
          remove: vi.fn().mockResolvedValue({}),
        },
      ];
      mockDocker.listContainers = vi.fn().mockResolvedValue(mockContainers);
      mockDocker.getContainer = vi.fn().mockImplementation((id) => mockContainers.find(c => c.Id === id));
      
      await sandboxManager.cleanupOrphanedContainers();
      expect(mockContainers[0].stop).toHaveBeenCalled();
      expect(mockContainers[0].remove).toHaveBeenCalled();
    });

    it('should throw a consolidated error and process all containers even if some fail', async () => {
      const mockContainers = [
        {
          Id: 'cont-fail-stop',
          inspect: vi.fn().mockResolvedValue({ Config: { Labels: { app: SANDBOX_APP_LABEL } } }),
          stop: vi.fn().mockRejectedValue(new Error('Stop failed')),
          remove: vi.fn().mockResolvedValue({}),
        },
        {
          Id: 'cont-success',
          inspect: vi.fn().mockResolvedValue({ Config: { Labels: { app: SANDBOX_APP_LABEL } } }),
          stop: vi.fn().mockResolvedValue({}),
          remove: vi.fn().mockResolvedValue({}),
        },
      ];
      mockDocker.listContainers = vi.fn().mockResolvedValue(mockContainers);
      mockDocker.getContainer = vi.fn().mockImplementation((id) => mockContainers.find(c => c.Id === id));
      
      await expect(sandboxManager.cleanupOrphanedContainers()).rejects.toThrow('Failed to cleanup some orphaned containers');
      expect(mockContainers[0].remove).toHaveBeenCalled();
      expect(mockContainers[1].stop).toHaveBeenCalled();
      expect(mockContainers[1].remove).toHaveBeenCalled();
    });

    it('should throw a collective error containing all failure messages', async () => {
      const mockContainers = [
        {
          Id: 'cont-1',
          inspect: vi.fn().mockResolvedValue({ Config: { Labels: { app: SANDBOX_APP_LABEL } } }),
          stop: vi.fn().mockRejectedValue(new Error('Error 1')),
          remove: vi.fn().mockResolvedValue({}),
        },
        {
          Id: 'cont-2',
          inspect: vi.fn().mockResolvedValue({ Config: { Labels: { app: SANDBOX_APP_LABEL } } }),
          stop: vi.fn().mockResolvedValue({}),
          remove: vi.fn().mockRejectedValue(new Error('Error 2')),
        },
      ];
      mockDocker.listContainers = vi.fn().mockResolvedValue(mockContainers);
      mockDocker.getContainer = vi.fn().mockImplementation((id) => mockContainers.find(c => c.Id === id));
      
      await expect(sandboxManager.cleanupOrphanedContainers()).rejects.toThrow(/Error 1.*Error 2/s);
    });

    it('should handle failures in listing or inspection', async () => {
      // List failure
      mockDocker.listContainers = vi.fn().mockRejectedValue(new Error('Docker API Error'));
      await expect(sandboxManager.cleanupOrphanedContainers()).rejects.toThrow(/Docker API Error/);
      
      // Inspect failure
      const mockContainers = [{ Id: 'cont-1', inspect: vi.fn().mockRejectedValue(new Error('Inspect failed')) }];
      mockDocker.listContainers = vi.fn().mockResolvedValue(mockContainers);
      mockDocker.getContainer = vi.fn().mockImplementation((id) => mockContainers[0]);
      await expect(sandboxManager.cleanupOrphanedContainers()).rejects.toThrow(/Inspect failed/);
    });

    it('should not throw when no containers match the label', async () => {
      const mockContainers = [{ Id: 'other', inspect: vi.fn().mockResolvedValue({ Config: { Labels: { app: 'other' } } }) }];
      mockDocker.listContainers = vi.fn().mockResolvedValue(mockContainers);
      mockDocker.getContainer = vi.fn().mockImplementation((id) => mockContainers[0]);
      await expect(sandboxManager.cleanupOrphanedContainers()).resolves.not.toThrow();
    });
  });

  describe('Catch Block Logging (FIX1.4)', () => {
    it('should log warn when pruneCache volume remove fails', async () => {
      const failingVolume = {
        remove: vi.fn().mockRejectedValue(new Error('Volume remove failed in prune')),
      };
      mockDocker.getVolume = vi.fn().mockReturnValue(failingVolume);

      await sandboxManager.createCacheForSession('session-1', 'lock-1');

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await sandboxManager.pruneCache();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('pruneCache: failed to remove volume')
      );

      warnSpy.mockRestore();
    });

    it('should log warn when teardown volume remove fails', async () => {
      const failingVolume = {
        remove: vi.fn().mockRejectedValue(new Error('Volume remove failed in teardown')),
      };
      mockDocker.getVolume = vi.fn().mockReturnValue(failingVolume);

      await sandboxManager.createCacheForSession('session-2', 'lock-2');

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await sandboxManager.teardown();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('teardown: failed to remove volume')
      );

      warnSpy.mockRestore();
    });
  });
});
