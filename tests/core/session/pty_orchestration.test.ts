import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Session } from '../../../src/core/session/session';
import { ISandbox } from '../../../src/types/contracts';
import * as pty from 'node-pty';

vi.mock('node-pty');

describe('Session PTY Orchestration', () => {
  let mockSandbox: ISandbox;
  let session: Session;
  let mockPtyProcess: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPtyProcess = {
      on: vi.fn(),
      off: vi.fn(),
      write: vi.fn(),
      kill: vi.fn(),
    };

    (pty.spawn as any).mockReturnValue(mockPtyProcess);

    mockSandbox = {
      init: vi.fn().mockResolvedValue(undefined),
      setup: vi.fn().mockResolvedValue(undefined),
      verify: vi.fn().mockResolvedValue(true),
      ping: vi.fn().mockResolvedValue(true),
      execute: vi.fn().mockResolvedValue(''),
      switchToState: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
      getWorkingDir: vi.fn().mockReturnValue('/app'),
    };

    session = new Session(mockSandbox);
  });

  it('should spawn a PTY process successfully', async () => {
    mockPtyProcess.on.mockImplementation((event: string, cb: any) => {
      if (event === 'data') {
        mockPtyProcess.write.mockImplementation((data: string) => {
          if (data === 'echo 1\r') {
            cb('1');
          }
        });
      }
    });

    await session.start();

    expect(pty.spawn).toHaveBeenCalledWith(
      '/bin/bash',
      [],
      expect.objectContaining({
        cwd: '/app',
        name: 'xterm-color',
      })
    );
  });

  it('should handle DockerSandbox specifically', async () => {
    const { DockerSandbox } = await import('../../../src/sandbox/docker');
    const dockerSandbox = new DockerSandbox({
      repoPath: 'http://github.com/test/test',
      image: 'ubuntu',
      commitHash: 'main',
    } as any);

    vi.spyOn(dockerSandbox, 'init').mockResolvedValue(undefined);
    vi.spyOn(dockerSandbox, 'getContainerId').mockReturnValue('container-123');
    vi.spyOn(dockerSandbox, 'getWorkingDir').mockReturnValue('/app');

    const dockerSession = new Session(dockerSandbox);

    mockPtyProcess.on.mockImplementation((event: string, cb: any) => {
      if (event === 'data') {
        mockPtyProcess.write.mockImplementation((data: string) => {
          if (data === 'echo 1\r') {
            cb('1');
          }
        });
      }
    });

    await dockerSession.start();

    expect(pty.spawn).toHaveBeenCalledWith(
      'docker',
      ['exec', '-it', 'container-123', '/bin/bash'],
      expect.objectContaining({
        cwd: process.cwd(),
      })
    );
  });

  it('should throw error if health check fails', async () => {
    mockPtyProcess.on.mockImplementation(() => {});

    await expect(session.start()).rejects.toThrow('PTY health check timed out');
  }, 10000);
});
