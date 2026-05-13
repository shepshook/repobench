import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DockerSandbox } from '../../src/sandbox/docker';
import { SandboxOptions } from '../../src/types/contracts';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import Docker from 'dockerode';

vi.mock('dockerode');
vi.mock('fs/promises');

describe('DockerSandbox Cache', () => {
  let options: SandboxOptions;
  let sandbox: DockerSandbox;
  let mockDocker: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    const cacheHostPath = path.join(os.tmpdir(), 'node_modules_cache');
    options = {
      repoPath: '/tmp/repo',
      image: 'node:20-slim',
      commitHash: 'master',
      cachePaths: {
        [cacheHostPath]: '/app/node_modules',
      },
    } as any;

    mockDocker = {
      createContainer: vi.fn().mockResolvedValue({
        start: vi.fn().mockResolvedValue({}),
        exec: vi.fn().mockResolvedValue({
          start: vi.fn().mockResolvedValue({
            on: vi.fn().mockImplementation((event, cb) => {
              if (event === 'data') cb('success');
              if (event === 'end') cb();
              return {};
            }),
          }),
          inspect: vi.fn().mockResolvedValue({ ExitCode: 0 }),
        }),
      }),
      getImage: vi.fn().mockResolvedValue({}),
    };

    vi.mocked(Docker).mockImplementation(function() {
      return mockDocker;
    });
    
    sandbox = new DockerSandbox(options);
  });

  it('should include cachePaths in Docker Binds', async () => {
    await sandbox.init();

    const callArgs = mockDocker.createContainer.mock.calls[0][0];
    const cacheHostPath = path.resolve(process.cwd(), path.join(os.tmpdir(), 'node_modules_cache'));
    
    expect(callArgs.HostConfig.Binds).toContain(
      `${cacheHostPath}:/app/node_modules:rw`
    );
  });

  it('should ensure host cache directories exist', async () => {
    await sandbox.init();

    const mkdirCalls = fs.mkdir.mock.calls;
    const cacheHostPath = path.resolve(process.cwd(), path.join(os.tmpdir(), 'node_modules_cache'));
    const hasCacheDir = mkdirCalls.some(call => 
      call[0].includes(cacheHostPath) && call[1].recursive === true
    );
    expect(hasCacheDir).toBe(true);
  });
});
