import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Session } from '../../../src/core/session/session';
import { ISandbox } from '../../../src/types/contracts';
import * as pty from 'node-pty';

vi.mock('node-pty');

describe('Session Lifecycle & Cleanup', () => {
  let mockSandbox: ISandbox;
  let session: Session;
  let mockPtyProcess: any;

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
      resize: vi.fn(),
      emit: (event: string) => {
        listeners.get(event)?.forEach(cb => cb());
      }
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

  async function startSession() {
    await session.start();
  }

  it('should terminate the PTY process on end()', async () => {
    await startSession();
    
    const endPromise = session.end();
    
    // Simulate the process exiting
    mockPtyProcess.emit('exit');
    
    await endPromise;
    expect(mockPtyProcess.kill).toHaveBeenCalled();
  });

  it('should not resolve end() until the process has exited', async () => {
    await startSession();
    
    let resolved = false;
    session.end().then(() => {
      resolved = true;
    });
    
    // Wait a bit to make sure it hasn't resolved yet
    await new Promise(r => setTimeout(r, 50));
    expect(resolved).toBe(false);
    
    mockPtyProcess.emit('exit');
    
    await new Promise(r => setTimeout(r, 50));
    expect(resolved).toBe(true);
  });

  it('should handle end() when process is already dead or null', async () => {
    // Case 1: session not started
    await expect(session.end()).resolves.toBeDefined();
    
    // Case 2: process exists but already dead (simulated by emitting exit immediately)
    await startSession();
    mockPtyProcess.emit('exit');
    await expect(session.end()).resolves.toBeDefined();
  });

  it('should call ptyProcess.resize when resize() is called', async () => {
    await startSession();
    await session.resize(120, 40);
    expect(mockPtyProcess.resize).toHaveBeenCalledWith(120, 40);
  });

  it('should throw error if resize is called before start', async () => {
    await expect(session.resize(120, 40)).rejects.toThrow('Session not started');
  });
});
