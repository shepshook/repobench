import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DockerSandbox } from '../../src/sandbox/docker';
import { SandboxOptions } from '../../src/types/contracts';
import Docker from 'dockerode';
import { spawn } from 'child_process';

vi.mock('dockerode');
vi.mock('child_process', async () => {
  const actual = await vi.importActual('child_process');
  return {
    ...actual,
    spawn: vi.fn(),
  };
});

describe('DockerSandbox Optimization Tests', () => {
  const mockOptions: SandboxOptions = {
    repoPath: 'https://github.com/test/repo',
    image: 'ubuntu:latest',
    commitHash: 'main',
    envVars: {},
  };

  let mockDocker: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDocker = {
      getImage: vi.fn(),
      createContainer: vi.fn().mockResolvedValue({
        start: vi.fn().mockResolvedValue({}),
        exec: vi.fn().mockResolvedValue({
          start: vi.fn().mockResolvedValue({
            on: vi.fn().mockImplementation(function(event, cb) {
              if (event === 'data') cb('mock data');
              if (event === 'end') cb();
              return this;
            }),
          }),
          inspect: vi.fn().mockResolvedValue({ ExitCode: 0 }),
        }),
        inspect: vi.fn().mockResolvedValue({ State: { Running: true } }),
      }),
    };
    vi.mocked(Docker).mockImplementation(function() {
      return mockDocker;
    });
    
    // Mock spawn to succeed
    vi.mocked(spawn).mockImplementation((cmd, args, options, callback) => {
      const mockProcess = {
        on: vi.fn().mockImplementation(function(event, cb) {
          if (event === 'close') cb(0);
          return this;
        }),
      };
      return mockProcess as any;
    });
  });

  it('should build the base image if it is missing and baseImagePath is provided', async () => {
    const optionsWithBase = {
      ...mockOptions,
      baseImage: 'repobench-base:latest',
      baseImagePath: 'docker/Dockerfile.base',
    };

    // Mock getImage to throw error (image not found)
    mockDocker.getImage.mockRejectedValueOnce(new Error('Not Found'));

    const sandbox = new DockerSandbox(optionsWithBase);
    await sandbox.init();

    expect(mockDocker.getImage).toHaveBeenCalledWith('repobench-base:latest');
    expect(spawn).toHaveBeenCalledWith('docker', ['build', '-t', 'repobench-base:latest', '-f', expect.any(String), expect.any(String)]);
  });

  it('should NOT build the base image if it already exists', async () => {
    const optionsWithBase = {
      ...mockOptions,
      baseImage: 'repobench-base:latest',
      baseImagePath: 'docker/Dockerfile.base',
    };

    // Mock getImage to succeed
    mockDocker.getImage.mockResolvedValueOnce({});

    const sandbox = new DockerSandbox(optionsWithBase);
    await sandbox.init();

    expect(mockDocker.getImage).toHaveBeenCalledWith('repobench-base:latest');
    expect(spawn).not.toHaveBeenCalled();
  });

  it('should NOT build the base image if baseImagePath is not provided', async () => {
    const optionsWithBase = {
      ...mockOptions,
      baseImage: 'repobench-base:latest',
    };

    mockDocker.getImage.mockRejectedValueOnce(new Error('Not Found'));

    const sandbox = new DockerSandbox(optionsWithBase);
    await sandbox.init();

    expect(mockDocker.getImage).toHaveBeenCalledWith('repobench-base:latest');
    expect(spawn).not.toHaveBeenCalled();
  });

  it('should use the base image for the container if provided', async () => {
    const optionsWithBase = {
      ...mockOptions,
      baseImage: 'repobench-base:latest',
    };

    mockDocker.getImage.mockResolvedValueOnce({});

    const sandbox = new DockerSandbox(optionsWithBase);
    await sandbox.init();

    expect(mockDocker.createContainer).toHaveBeenCalledWith(expect.objectContaining({
      Image: 'repobench-base:latest',
    }));
  });
});
