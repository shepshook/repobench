import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Session } from '../../../src/core/session/session';
import { ISandbox } from '../../../src/types/contracts';

describe('Session PTY Basic', () => {
  let mockSandbox: ISandbox;
  let session: Session;

  beforeEach(() => {
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

  it('start() should successfully spawn a process', async () => {
    await session.start();
    // ptyProcess is private, but we can check if start didn't throw and maybe use (session as any)
    expect((session as any).ptyProcess).not.toBeNull();
  });

  it('write() should not call sandbox.execute', async () => {
    await session.start();
    await session.write('echo hello');
    expect(mockSandbox.execute).not.toHaveBeenCalled();
  });

  it('should maintain session persistence (cd and pwd)', async () => {
    await session.start();
    
    // Navigate to a directory and check pwd
    await session.write('cd ..');
    await session.write('pwd');
    
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    const result = await session.end();
    
    const pwdOutput = result.stdout.split('pwd').pop();
    expect(pwdOutput).toContain('D:\\dev');
    expect(pwdOutput).not.toContain('D:\\dev\\RepoBench');
  });
});
