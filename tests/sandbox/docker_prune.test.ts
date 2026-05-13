import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DockerSandbox } from '../../src/sandbox/docker';
import { SandboxOptions } from '../../src/types/contracts';
import Docker from 'dockerode';

vi.mock('dockerode');

describe('DockerSandbox Image Pruning', () => {
  const mockOptions: SandboxOptions = {
    repoPath: 'https://github.com/test/repo',
    image: 'ubuntu:latest',
    commitHash: 'main',
    maxCachedLayers: 10,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should prune images exceeding maxCachedLayers', async () => {
    const mockImages = [];
    for (let i = 0; i < 15; i++) {
      mockImages.push({
        Id: `sha256-img-${i}`,
        RepoTags: [`repobench-layer-img-${i}:latest`],
        Created: Date.now() - i * 1000, // Older as i increases
      });
    }

    const removeMock = vi.fn().mockResolvedValue({});
    vi.mocked(Docker).mockImplementation(function() {
      return {
        listImages: vi.fn().mockResolvedValue(mockImages),
        getImage: vi.fn().mockReturnValue({
          remove: removeMock,
        }),
      };
    });

    const sandbox = new DockerSandbox(mockOptions);
    // Use destroy since pruneCachedImages is private and called there
    await sandbox.destroy();

    // Should keep 10 most recent (i=0 to 9), delete 5 oldest (i=10 to 14)
    expect(removeMock).toHaveBeenCalledTimes(5);
    for (let i = 10; i < 15; i++) {
      expect(removeMock).toHaveBeenCalledWith({ force: false });
    }
  });

  it('should not prune images below maxCachedLayers', async () => {
    const mockImages = [];
    for (let i = 0; i < 5; i++) {
      mockImages.push({
        Id: `sha256-img-${i}`,
        RepoTags: [`repobench-layer-img-${i}:latest`],
        Created: Date.now() - i * 1000,
      });
    }

    const removeMock = vi.fn().mockResolvedValue({});
    vi.mocked(Docker).mockImplementation(function() {
      return {
        listImages: vi.fn().mockResolvedValue(mockImages),
        getImage: vi.fn().mockReturnValue({
          remove: removeMock,
        }),
      };
    });

    const sandbox = new DockerSandbox(mockOptions);
    await sandbox.destroy();

    expect(removeMock).not.toHaveBeenCalled();
  });

  it('should only prune images with repobench-layer- prefix', async () => {
    const mockImages = [
      {
        Id: `sha256-layer-1`,
        RepoTags: [`repobench-layer-1:latest`],
        Created: Date.now() - 1000,
      },
      {
        Id: `sha256-other-1`,
        RepoTags: [`other-image-1:latest`],
        Created: Date.now() - 2000,
      },
      {
        Id: `sha256-layer-2`,
        RepoTags: [`repobench-layer-2:latest`],
        Created: Date.now() - 3000,
      },
    ];

    const removeMock = vi.fn().mockResolvedValue({});
    vi.mocked(Docker).mockImplementation(function() {
      return {
        listImages: vi.fn().mockResolvedValue(mockImages),
        getImage: vi.fn().mockReturnValue({
          remove: removeMock,
        }),
      };
    });

    const sandbox = new DockerSandbox({ ...mockOptions, maxCachedLayers: 1 });
    await sandbox.destroy();

    // Keep layer-1, delete layer-2. other-image-1 should NOT be deleted.
    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(removeMock).toHaveBeenCalledWith({ force: false });
  });

  it('should handle remove failures gracefully', async () => {
    const mockImages = [];
    for (let i = 0; i < 15; i++) {
      mockImages.push({
        Id: `sha256-img-${i}`,
        RepoTags: [`repobench-layer-img-${i}:latest`],
        Created: Date.now() - i * 1000,
      });
    }

    const removeMock = vi.fn().mockRejectedValue(new Error('Image in use'));
    vi.mocked(Docker).mockImplementation(function() {
      return {
        listImages: vi.fn().mockResolvedValue(mockImages),
        getImage: vi.fn().mockReturnValue({
          remove: removeMock,
        }),
      };
    });

    const sandbox = new DockerSandbox(mockOptions);
    await expect(sandbox.destroy()).resolves.not.toThrow();
    expect(removeMock).toHaveBeenCalledTimes(5);
  });
});
