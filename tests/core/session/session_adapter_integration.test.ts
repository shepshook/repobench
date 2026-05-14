import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Session } from '../../../src/core/session/session';
import { AiderAdapter } from '../../../src/core/session/adapters/aider';
import * as pty from 'node-pty';

vi.mock('node-pty');

describe('Session Adapter Integration', () => {
  const mockSandbox = {
    init: vi.fn().mockResolvedValue(undefined),
    getWorkingDir: vi.fn().mockReturnValue('/tmp/repo'),
    setup: vi.fn().mockResolvedValue(undefined),
    verify: vi.fn().mockResolvedValue(true),
    ping: vi.fn().mockResolvedValue(true),
    execute: vi.fn().mockResolvedValue(''),
    switchToState: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use adapter for spawn command', async () => {
    const adapter = new AiderAdapter();
    const session = new Session(mockSandbox as any, { 
      adapter, 
      spawnOptions: { model: 'gpt-4o', extraArgs: '--yes' } 
    });

    const ptyProcess = {
      onData: vi.fn((cb) => {
        cb('> ');
      }),
      write: vi.fn(),
      kill: vi.fn(),
    };
    (pty.spawn as any).mockReturnValue(ptyProcess);

    await session.start();

    expect(pty.spawn).toHaveBeenCalledWith(
      'aider', 
      ['--model', 'gpt-4o', '--no-git', '--yes'], 
      expect.any(Object)
    );
  });

  it('should handle auto-responses from adapter', async () => {
    const adapter = new AiderAdapter();
    const session = new Session(mockSandbox as any, { 
      adapter,
      spawnOptions: { model: 'gpt-4o', extraArgs: '--yes' }
    });

    let onDataCallback: (data: string) => void = () => {};
    const ptyProcess = {
      onData: vi.fn((cb) => {
        onDataCallback = cb;
        cb('> '); // Initial prompt
      }),
      write: vi.fn((data) => {
        // Simulate shell returning a prompt after every write
        setTimeout(() => onDataCallback('> '), 10);
      }),
      kill: vi.fn(),
    };
    (pty.spawn as any).mockReturnValue(ptyProcess);

    await session.start();

    // Simulate prompt from Aider
    onDataCallback('Do you want to run the tests?');
    
    // Need to wait for ping() to complete (which waits for a prompt)
    // and then for the actual response to be written.
    await new Promise(resolve => setTimeout(resolve, 200));
    
    expect(ptyProcess.write).toHaveBeenCalledWith('Yes\n\r\n');
  });
 
  it('should not respond to the same prompt multiple times', async () => {
    const adapter = new AiderAdapter();
    const session = new Session(mockSandbox as any, { 
      adapter,
      spawnOptions: { model: 'gpt-4o', extraArgs: '--yes' }
    });
 
    let onDataCallback: (data: string) => void = () => {};
    const ptyProcess = {
      onData: vi.fn((cb) => {
        onDataCallback = cb;
        cb('> '); // Initial prompt
      }),
      write: vi.fn((data) => {
        setTimeout(() => onDataCallback('> '), 10);
      }),
      kill: vi.fn(),
    };
    (pty.spawn as any).mockReturnValue(ptyProcess);
 
    await session.start();
 
    // Simulate prompt
    onDataCallback('Do you want to run the tests?');
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // One for ping, one for the response
    expect(ptyProcess.write).toHaveBeenCalledTimes(2);
    expect(ptyProcess.write).toHaveBeenCalledWith('Yes\n\r\n');
 
    // Simulate more data arriving, but not a new prompt
    onDataCallback('Some other output');
    onDataCallback('More output');
 
    await new Promise(resolve => setTimeout(resolve, 200));
 
    // Should still have only responded once (still 2 calls total: 1 ping + 1 response)
    expect(ptyProcess.write).toHaveBeenCalledTimes(2);
  });
 
  it('should handle split prompts from adapter', async () => {
    const adapter = new AiderAdapter();
    const session = new Session(mockSandbox as any, { 
      adapter,
      spawnOptions: { model: 'gpt-4o', extraArgs: '--yes' }
    });

    let onDataCallback: (data: string) => void = () => {};
    const ptyProcess = {
      onData: vi.fn((cb) => {
        onDataCallback = cb;
        cb('> '); // Initial prompt
      }),
      write: vi.fn((data) => {
        setTimeout(() => onDataCallback('> '), 10);
      }),
      kill: vi.fn(),
    };
    (pty.spawn as any).mockReturnValue(ptyProcess);

    await session.start();

    // Simulate prompt split across chunks
    onDataCallback('Do you want');
    onDataCallback(' to run the tests?');

    await new Promise(resolve => setTimeout(resolve, 200));

    expect(ptyProcess.write).toHaveBeenCalledWith('Yes\n\r\n');
  });

  it('should fall back to default shell if no adapter provided', async () => {
    const session = new Session(mockSandbox as any);

    const ptyProcess = {
      onData: vi.fn((cb) => {
        cb('> ');
      }),
      write: vi.fn(),
      kill: vi.fn(),
    };
    (pty.spawn as any).mockReturnValue(ptyProcess);

    await session.start();

    const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';
    expect(pty.spawn).toHaveBeenCalledWith(
      shell, 
      expect.any(Array), 
      expect.any(Object)
    );
  });
});
