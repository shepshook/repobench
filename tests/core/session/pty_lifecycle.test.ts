import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Session } from '../../../src/core/session/session';
import { ISandbox } from '../../../src/types/contracts';
import { SessionCrashedError } from '../../../src/core/session/errors';
import * as pty from 'node-pty';

vi.mock('node-pty');

describe('Session PTY Lifecycle', () => {
  let mockSandbox: ISandbox;
  let session: Session;
  let mockPtyProcess: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPtyProcess = {
      onData: vi.fn(),
      write: vi.fn(),
      kill: vi.fn(),
    };
    (pty.spawn as any).mockReturnValue(mockPtyProcess);

    mockSandbox = {
      init: vi.fn().mockResolvedValue(undefined),
      setup: vi.fn().mockResolvedValue(undefined),
      verify: vi.fn().mockResolvedValue(true),
      ping: vi.fn().mockResolvedValue(true),
      execute: vi.fn().mockResolvedValue('mock output'),
      switchToState: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
      getWorkingDir: vi.fn().mockReturnValue('D:\\dev\\RepoBench'),
    };
    session = new Session(mockSandbox);
  });

  it('start() should be idempotent and only spawn one process', async () => {
    await session.start();
    await session.start();
    
    expect(pty.spawn).toHaveBeenCalledTimes(1);
  });

  it('end() should clear pending reads and nullify ptyProcess', async () => {
    await session.start();
    
    // Create a pending read
    const readPromise = session.readUntil(/something/);
    
    await session.end();
    
    await expect(readPromise).rejects.toThrow('Session ended');
    expect((session as any).ptyProcess).toBeNull();
    expect((session as any).pendingReads).toHaveLength(0);
  });

  it('write() should throw SessionCrashedError when ping fails', async () => {
    await session.start();
    
    // Mock readUntil to fail for the ping
    vi.spyOn(session, 'readUntil').mockRejectedValue(new Error('Timeout'));
    
    await expect(session.write('ls')).rejects.toThrow(SessionCrashedError);
    expect((session as any).isCrashed).toBe(true);
  });
});
