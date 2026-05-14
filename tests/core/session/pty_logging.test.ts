import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Session } from '../../../src/core/session/session';
import { ISandbox } from '../../../src/types/contracts';
import * as pty from 'node-pty';
import * as fs from 'fs';
import { mkdir } from 'fs/promises';

vi.mock('node-pty');
vi.mock('fs');
vi.mock('fs/promises');

describe('Session PTY Logging', () => {
  let mockSandbox: ISandbox;
  let session: Session;
  let mockPtyProcess: any;
  let mockWriteStream: any;

  beforeEach(() => {
    vi.clearAllMocks();

    const listeners = new Map<string, Set<Function>>();

    mockPtyProcess = {
      on: vi.fn((event: string, cb: Function) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event)!.add(cb);
      }),
      off: vi.fn((event: string, cb: Function) => {
        listeners.get(event)?.delete(cb);
      }),
      write: vi.fn((data: string) => {
        if (data === 'echo 1\r') {
          listeners.get('data')?.forEach(cb => cb('1'));
        }
      }),
      kill: vi.fn(),
      emitData: (data: string) => {
        listeners.get('data')?.forEach(cb => cb(data));
      }
    };

    (pty.spawn as any).mockReturnValue(mockPtyProcess);

    mockWriteStream = {
      write: vi.fn(),
      end: vi.fn(),
    };

    (fs.createWriteStream as any).mockReturnValue(mockWriteStream);
    (mkdir as any).mockResolvedValue(undefined);

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

  async function startSession() {
    await session.start();
  }

  it('should create logs directory and a log file on start', async () => {
    await startSession();
    expect(mkdir).toHaveBeenCalledWith('logs', { recursive: true });
    expect(fs.createWriteStream).toHaveBeenCalledWith(
      expect.stringMatching(/logs[\\/]session_\d+\.log/),
      { flags: 'a' }
    );
  });

  it('should log outgoing and incoming traffic', async () => {
    await startSession();

    await session.write('ls');
    expect(mockWriteStream.write).toHaveBeenCalledWith('[OUT] ls\r\n');

    mockPtyProcess.emitData('file1\nfile2\n');
    expect(mockWriteStream.write).toHaveBeenCalledWith('[IN] file1\nfile2\n');
  });

  it('should close the log stream on end', async () => {
    await startSession();
    await session.end();
    expect(mockWriteStream.end).toHaveBeenCalled();
  });
});
