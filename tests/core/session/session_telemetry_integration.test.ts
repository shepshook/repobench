import { describe, it, expect, vi } from 'vitest';
import { Session } from '../../../src/core/session/session';
import { ISandbox } from '../../../src/types/contracts';
import * as pty from 'node-pty';

vi.mock('node-pty');

describe('Session Telemetry Integration', () => {
  const mockSandbox: ISandbox = {
    init: vi.fn().mockResolvedValue(undefined),
    setup: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    getWorkingDir: vi.fn().mockResolvedValue('/tmp/workdir'),
  };

  it('should extract cost data for aider agent', async () => {
    const mockPtyProcess = {
      onData: vi.fn(),
      write: vi.fn(),
      kill: vi.fn(),
    };
    (pty.spawn as any).mockReturnValue(mockPtyProcess);

    const session = new Session(mockSandbox, { 
      agentName: 'aider',
      spawnOptions: { model: 'gpt-4' } 
    });
    
    const startPromise = session.start();

    // Wait for onData to be called
    while (mockPtyProcess.onData.mock.calls.length === 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    const onDataCallback = mockPtyProcess.onData.mock.calls[0][0];
    onDataCallback('> ');
    await startPromise;

    // Simulate aider's cost output
    onDataCallback('Total tokens: 1000 (input: 800, output: 200)');

    const result = await session.end();

    expect(result.tokensUsed).toEqual({ input: 800, output: 200 });
    expect(result.cost).toBe(0);
  });

  it('should extract cost data for claude agent', async () => {
    const mockPtyProcess = {
      onData: vi.fn(),
      write: vi.fn(),
      kill: vi.fn(),
    };
    (pty.spawn as any).mockReturnValue(mockPtyProcess);

    const session = new Session(mockSandbox, { 
      agentName: 'claude',
      spawnOptions: { model: 'claude-3' } 
    });
    
    const startPromise = session.start();

    // Wait for onData to be called
    while (mockPtyProcess.onData.mock.calls.length === 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    const onDataCallback = mockPtyProcess.onData.mock.calls[0][0];
    onDataCallback('> ');
    await startPromise;

    // Simulate claude's cost output
    onDataCallback('800 input tokens, 200 output tokens');

    const result = await session.end();

    expect(result.tokensUsed).toEqual({ input: 800, output: 200 });
    expect(result.cost).toBe(0);
  });

  it('should use default values when no cost data is found', async () => {
    const mockPtyProcess = {
      onData: vi.fn(),
      write: vi.fn(),
      kill: vi.fn(),
    };
    (pty.spawn as any).mockReturnValue(mockPtyProcess);

    const session = new Session(mockSandbox, { 
      agentName: 'aider',
      spawnOptions: { model: 'gpt-4' } 
    });
    
    const startPromise = session.start();

    // Wait for onData to be called
    while (mockPtyProcess.onData.mock.calls.length === 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    const onDataCallback = mockPtyProcess.onData.mock.calls[0][0];
    onDataCallback('> ');
    await startPromise;

    onDataCallback('some other output');

    const result = await session.end();

    expect(result.tokensUsed).toEqual({ input: 0, output: 0 });
    expect(result.cost).toBe(0);
  });
});
