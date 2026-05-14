import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Session } from '../../../src/core/session/session';
import { ISandbox } from '../../../src/types/contracts';
import * as pty from 'node-pty';

vi.mock('node-pty');

describe('Session PTY I/O', () => {
  let mockSandbox: ISandbox;
  let session: Session;
  let mockPtyProcess: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPtyProcess = {
      write: vi.fn(),
      onData: vi.fn((cb) => {
        (mockPtyProcess as any).dataCallback = cb;
      }),
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

  it('readUntil does NOT resolve immediately if regex is already in buffer', async () => {
    await session.start();
    // Manually inject data into stdout
    (session as any).stdout = 'Welcome to PowerShell\nPS C:\\>';
    
    const readPromise = session.readUntil(/PS C:\\>/);
    
    // Check that it's still pending (using a small timeout or just not awaiting yet)
    let resolved = false;
    readPromise.then(() => { resolved = true; });
    
    // Wait a bit to make sure it doesn't resolve immediately
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(resolved).toBe(false);
    
    // Now simulate new output with the prompt
    mockPtyProcess.dataCallback('New output\nPS C:\\>');
    
    const result = await readPromise;
    expect(result).toContain('New output\nPS C:\\>');
  });

  it('readUntil resolves when PTY produces matching string', async () => {
    await session.start();
    
    const readPromise = session.readUntil(/Success/);
    
    // Simulate PTY output
    mockPtyProcess.dataCallback('Some output...\n');
    mockPtyProcess.dataCallback('Operation Success!\n');
    
    const result = await readPromise;
    expect(result).toContain('Operation Success!');
  });

  it('readUntil throws timeout error if regex is never matched', async () => {
    await session.start();
    
    const readPromise = session.readUntil(/NeverFound/, 100);
    
    mockPtyProcess.dataCallback('Something else\n');
    
    await expect(readPromise).rejects.toThrow('Timeout waiting for regex /NeverFound/ after 100ms');
  });

  it('write() waits for a NEW prompt even if one already exists in buffer', async () => {
    await session.start();
    
    // Simulate initial prompt in buffer
    mockPtyProcess.dataCallback('PS C:\\>');
    
    let writeResolved = false;
    const writePromise = session.write('echo hello').then(() => {
      writeResolved = true;
    });
    
    // Should still be pending because it needs a NEW prompt
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(writeResolved).toBe(false);
    
    // Simulate command output and new prompt
    mockPtyProcess.dataCallback('hello\nPS C:\\>');
    
    await writePromise;
    expect(writeResolved).toBe(true);
  });
});
