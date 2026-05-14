import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Session } from '../../../src/core/session/session';
import { AgentAdapter } from '../../../src/core/session/adapter';
import { ISandbox } from '../../../src/types/contracts';
import * as pty from 'node-pty';

vi.mock('node-pty');

class MockSandbox implements ISandbox {
  async init() {}
  async setup() {}
  async verify() { return true; }
  async ping() { return true; }
  async execute() { return ''; }
  async switchToState() {}
  async destroy() {}
  getWorkingDir() { return '/tmp/mock-repo'; }
}

class MockAdapter extends AgentAdapter {
  protected shell = 'bash';
  protected getArgs() { return []; }
  constructor(doneSignature: RegExp) {
    super();
    this.doneSignatures = [doneSignature];
  }
}

class MockPty {
  onDataCallback: ((data: string) => void) | null = null;
  onData(cb: (data: string) => void) {
    this.onDataCallback = cb;
  }
  write = vi.fn();
  kill = vi.fn();
  
  send(data: string) {
    if (this.onDataCallback) {
      this.onDataCallback(data);
    }
  }
}

describe('Session Termination', () => {
  let sandbox: MockSandbox;
  let ptyMock: MockPty;

  beforeEach(() => {
    vi.useFakeTimers();
    sandbox = new MockSandbox();
    ptyMock = new MockPty();
    (pty.spawn as any).mockReturnValue(ptyMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  async function startSession(session: Session, timeoutMs?: number) {
    const startPromise = session.start(timeoutMs);
    
    // Wait for PTY to be spawned and onData callback to be registered
    while (!ptyMock.onDataCallback) {
      await Promise.resolve();
    }
    
    // Provide initial prompt to let start() resolve
    ptyMock.send('> ');
    
    await startPromise;
  }

  it('should terminate session after timeout', async () => {
    const session = new Session(sandbox);
    const timeoutMs = 500;
    
    await startSession(session, timeoutMs);
    
    // Advance timers to trigger timeout
    vi.advanceTimersByTime(timeoutMs);
    await Promise.resolve();
    
    const result = await session.end();
    expect(result.duration).toBeGreaterThanOrEqual(timeoutMs);
    expect(ptyMock.kill).toHaveBeenCalled();
  });

  it('should not terminate session before timeout', async () => {
    const session = new Session(sandbox);
    const timeoutMs = 2000;
    
    await startSession(session, timeoutMs);
    
    // Advance timers, but less than timeout
    vi.advanceTimersByTime(500);
    await Promise.resolve();
    
    const result = await session.end();
    expect(result.duration).toBeLessThan(timeoutMs);
  });

  it('should terminate session automatically on Done signature', async () => {
    const adapter = new MockAdapter(/DONE/);
    const session = new Session(sandbox, { adapter });
    
    await startSession(session);
    
    // Simulate agent outputting the Done signature
    ptyMock.send('Agent says: DONE');
    
    // Allow end() to be called asynchronously
    await Promise.resolve();
    
    expect(ptyMock.kill).toHaveBeenCalled();
  });

  it('should reject pending reads when session terminates', async () => {
    const adapter = new MockAdapter(/DONE/);
    const session = new Session(sandbox, { adapter });
    
    await startSession(session);
    
    // Create a pending read
    const readPromise = session.readUntil(/NEVER_MATCHES/);
    
    // Trigger termination via Done signature
    ptyMock.send('DONE');
    await Promise.resolve();
    
    await expect(readPromise).rejects.toThrow('Session ended');
  });
});
