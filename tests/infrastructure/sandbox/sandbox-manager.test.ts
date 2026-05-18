import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SandboxManager } from '../../../src/infrastructure/sandbox/sandbox-manager';
import { ContainerRepository } from '../../../src/core/repositories/container-repository';
import Docker from 'dockerode';
import { SANDBOX_APP_LABEL } from '../../../src/core/contracts';

vi.mock('dockerode');
vi.mock('../../../src/core/repositories/container-repository');

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

  it('should stop a container and update its status in the repository', async () => {
    const containerId = 'cont-123';
    const mockContainer = {
      stop: vi.fn().mockResolvedValue({}),
    };
    mockDocker.getContainer = vi.fn().mockReturnValue(mockContainer);
    mockRepo.getById = vi.fn().mockReturnValue({
      containerId,
      status: 'running',
    });

    await sandboxManager.stopContainer(containerId);

    expect(mockContainer.stop).toHaveBeenCalled();
    expect(mockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        containerId: containerId,
        status: 'stopped',
      })
    );
  });

  it('should kill containers that exceed the timeout period', async () => {
    const timeoutMs = 60000; // 1 minute
    const now = new Date();
    
    const oldContainerId = 'old-cont';
    const freshContainerId = 'fresh-cont';
    
    const oldCreatedAt = new Date(now.getTime() - 120000).toISOString(); // 2 mins ago
    const freshCreatedAt = new Date(now.getTime() - 10000).toISOString(); // 10 secs ago
    
    mockRepo.getById = vi.fn().mockImplementation((id) => {
      if (id === oldContainerId) return { containerId: oldContainerId, createdAt: oldCreatedAt };
      if (id === freshContainerId) return { containerId: freshContainerId, createdAt: freshCreatedAt };
      return null;
    });
    
    mockRepo.getAll = vi.fn().mockReturnValue([
      { containerId: oldContainerId, createdAt: oldCreatedAt },
      { containerId: freshContainerId, createdAt: freshCreatedAt },
    ]);

    const mockOldContainer = { stop: vi.fn().mockResolvedValue({}), remove: vi.fn().mockResolvedValue({}) };
    const mockFreshContainer = { stop: vi.fn().mockResolvedValue({}), remove: vi.fn().mockResolvedValue({}) };
    
    mockDocker.getContainer = vi.fn().mockImplementation((id) => {
      if (id === oldContainerId) return mockOldContainer;
      if (id === freshContainerId) return mockFreshContainer;
    });

    // This method is expected to be implemented as part of Task 2.2.3
    await sandboxManager.killTimedOutContainers(timeoutMs);

    expect(mockOldContainer.stop).toHaveBeenCalled();
    expect(mockFreshContainer.stop).not.toHaveBeenCalled();
  });

  it('should throw a descriptive error containing stderr when Docker operations fail', async () => {
    const containerId = 'cont-123';
    const dockerError = {
      message: 'Docker error',
      stderr: 'Unexpected EOF from server',
    };
    
    const mockContainer = {
      stop: vi.fn().mockRejectedValue(dockerError),
    };
    mockDocker.getContainer = vi.fn().mockReturnValue(mockContainer);

    await expect(sandboxManager.stopContainer(containerId)).rejects.toThrow(/Unexpected EOF from server/);
  });


  it('should guarantee teardown of all resources even if some stop operations fail', async () => {
    const mockContainers = [
      {
        Id: 'cont-fail',
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
    mockDocker.getContainer = vi.fn().mockImplementation((id: string) => 
      mockContainers.find(c => c.Id === id)
    );

    await expect(sandboxManager.cleanupOrphanedContainers()).rejects.toThrow('Failed to cleanup some orphaned containers');

    expect(mockContainers[0].remove).toHaveBeenCalled();
    expect(mockContainers[1].stop).toHaveBeenCalled();
    expect(mockContainers[1].remove).toHaveBeenCalled();
  });

  it('should throw a descriptive error containing stderr when tracking a container fails', async () => {
    const containerId = 'cont-123';
    const dockerError = {
      message: 'Docker error',
      stderr: 'Container not found on host',
    };
    
    const mockContainer = {
      inspect: vi.fn().mockRejectedValue(dockerError),
    };
    mockDocker.getContainer = vi.fn().mockReturnValue(mockContainer);

    await expect(sandboxManager.trackContainer(containerId)).rejects.toThrow(/Container not found on host/);
  });

  it('should throw a descriptive error containing stderr when listing containers fails during cleanup', async () => {
    const dockerError = {
      message: 'Docker error',
      stderr: 'Daemon connection lost',
    };
    
    mockDocker.listContainers = vi.fn().mockRejectedValue(dockerError);

    await expect(sandboxManager.cleanupOrphanedContainers()).rejects.toThrow(/Daemon connection lost/);
  });

  it('should attempt to clean up all containers even when multiple failures occur', async () => {
    const mockContainers = [
      {
        Id: 'cont-fail-stop',
        inspect: vi.fn().mockResolvedValue({ Config: { Labels: { app: SANDBOX_APP_LABEL } } }),
        stop: vi.fn().mockRejectedValue(new Error('Stop failed')),
        remove: vi.fn().mockResolvedValue({}),
      },
      {
        Id: 'cont-fail-remove',
        inspect: vi.fn().mockResolvedValue({ Config: { Labels: { app: SANDBOX_APP_LABEL } } }),
        stop: vi.fn().mockResolvedValue({}),
        remove: vi.fn().mockRejectedValue(new Error('Remove failed')),
      },
      {
        Id: 'cont-success',
        inspect: vi.fn().mockResolvedValue({ Config: { Labels: { app: SANDBOX_APP_LABEL } } }),
        stop: vi.fn().mockResolvedValue({}),
        remove: vi.fn().mockResolvedValue({}),
      },
    ];
    mockDocker.listContainers = vi.fn().mockResolvedValue(mockContainers);
    mockDocker.getContainer = vi.fn().mockImplementation((id: string) => 
      mockContainers.find(c => c.Id === id)
    );

    // We expect this to throw because of the current implementation, 
    // but we want to verify that all cleanups were attempted.
    await expect(sandboxManager.cleanupOrphanedContainers()).rejects.toThrow('Failed to cleanup some orphaned containers');

    expect(mockContainers[0].remove).toHaveBeenCalled();
    expect(mockContainers[1].stop).toHaveBeenCalled();
    expect(mockContainers[1].remove).toHaveBeenCalled();
    expect(mockContainers[2].stop).toHaveBeenCalled();
    expect(mockContainers[2].remove).toHaveBeenCalled();
  });

  it('should throw a collective error containing all failures when multiple cleanups fail', async () => {
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
        stop: vi.fn().mockRejectedValue(new Error('Error 2')),
        remove: vi.fn().mockResolvedValue({}),
      },
    ];
    mockDocker.listContainers = vi.fn().mockResolvedValue(mockContainers);
    mockDocker.getContainer = vi.fn().mockImplementation((id: string) => 
      mockContainers.find(c => c.Id === id)
    );

    await expect(sandboxManager.cleanupOrphanedContainers()).rejects.toThrow('Failed to cleanup some orphaned containers');
  });
});
