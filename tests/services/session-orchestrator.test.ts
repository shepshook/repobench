import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionOrchestrator } from '../../src/core/services/session-orchestrator';
import { PtySession } from '../../src/infrastructure/pty-session';
import { AgentAdapterFactory } from '../../src/core/services/agent-adapter-factory';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { PromptHandler } from '../../src/core/services/prompt-handler';
import { IDoneDetector } from '../../src/core/contracts';

vi.mock('../../src/infrastructure/pty-session');
vi.mock('../../src/core/services/agent-adapter-factory');

describe('SessionOrchestrator Integration', () => {
  let orchestrator: SessionOrchestrator;
  let mockSandbox: Sandbox;
  let mockDoneDetector: IDoneDetector;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockDoneDetector = {
      isDone: vi.fn().mockReturnValue(false),
      setSignatures: vi.fn(),
    };

    // Injecting mockDoneDetector as required by Task 3.4.4
    orchestrator = new SessionOrchestrator(mockDoneDetector);
    
    mockSandbox = {
      createSnapshot: vi.fn().mockResolvedValue(undefined),
      restoreSnapshot: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
      destroy: vi.fn().mockResolvedValue(undefined),
      id: 'mock-sandbox',
      config: {},
      getContainer: vi.fn().mockReturnValue({ id: 'mock-container' }),
      registerSession: vi.fn(),
      unregisterSession: vi.fn(),
    } as unknown as Sandbox;
    (AgentAdapterFactory.createAdapter as any).mockReturnValue({
      interactionMap: new Map(),
      getStartupCommand: () => 'agent-cli',
    });
    (PtySession.create as any).mockResolvedValue({
      onData: vi.fn(),
      onTimeout: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
      getScreenState: vi.fn(),
      waitForExit: vi.fn(),
    });
  });

  it('should call createSnapshot on the sandbox during session creation', async () => {
    const config = {
      agentId: 'test-agent',
      model: 'gpt-4',
      temperature: 0.7,
      systemPrompt: 'You are a helpful assistant',
      cliArgs: ['--verbose'],
    };
    
    await orchestrator.createSession(config, mockSandbox);
    expect(mockSandbox.createSnapshot).toHaveBeenCalled();
  });

  it('should integrate PromptHandler during session creation to process PTY output', async () => {
    const config = {
      agentId: 'test-agent',
      model: 'gpt-4',
      temperature: 0.7,
      systemPrompt: 'You are a helpful assistant',
      cliArgs: ['--verbose'],
    };

    const mockSession = {
      onData: vi.fn(),
      onTimeout: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
      getScreenState: vi.fn(),
    };

    (PtySession.create as any).mockResolvedValue(mockSession);
    (AgentAdapterFactory.createAdapter as any).mockReturnValue({
      interactionMap: new Map([['Confirm\\? \\[y/n\\]', 'y']]),
      getStartupCommand: () => 'agent-cli',
    });

    const session = await orchestrator.createSession(config, mockSandbox);

    expect(mockSession.onData).toHaveBeenCalled();
    
    const dataCallback = (mockSession.onData as any).mock.calls[0][0];
    const promptHandler = new PromptHandler();
    promptHandler.setRules([{ pattern: 'Confirm\\? \\[y/n\\]', response: 'y' }]);
    
    dataCallback('Confirm? [y/n]');
    expect(mockSession.write).toHaveBeenCalledWith('y\n');
  });

  it('should configure DoneDetector with signatures from agent config during session creation', async () => {
    const signatures = [
      { pattern: 'Task completed', name: 'completion' },
      { pattern: 'I have finished', name: 'completion' },
    ];
    const config = {
      agentId: 'test-agent',
      model: 'gpt-4',
      temperature: 0.7,
      systemPrompt: 'You are a helpful assistant',
      cliArgs: ['--verbose'],
      completionSignatures: signatures,
    } as any;

    await orchestrator.createSession(config, mockSandbox);

    expect(mockDoneDetector.setSignatures).toHaveBeenCalledWith(signatures);
  });

  it('should terminate session when DoneDetector signals completion', async () => {
    const config = {
      agentId: 'test-agent',
      model: 'gpt-4',
      temperature: 0.7,
      systemPrompt: 'You are a helpful assistant',
      cliArgs: ['--verbose'],
    };

    const mockSession = {
      onData: vi.fn(),
      onTimeout: vi.fn(),
      write: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
      getScreenState: vi.fn(),
    };

    (PtySession.create as any).mockResolvedValue(mockSession);
    
    const session = await orchestrator.createSession(config, mockSandbox);
    
    // Simulate data that DoneDetector recognizes as 'done'
    mockDoneDetector.isDone.mockReturnValue(true);
    const dataCallback = (mockSession.onData as any).mock.calls[0][0];
    
    await dataCallback('Task completed successfully.');
    
    expect(mockSession.close).toHaveBeenCalled();
  });

  it('should throw a descriptive error when session.close fails during completion', async () => {
    const config = {
      agentId: 'test-agent',
      model: 'gpt-4',
      temperature: 0.7,
      systemPrompt: 'You are a helpful assistant',
      cliArgs: ['--verbose'],
    };

    const mockSession = {
      onData: vi.fn(),
      onTimeout: vi.fn(),
      write: vi.fn(),
      close: vi.fn().mockRejectedValue(new Error('Close failed')),
      getScreenState: vi.fn(),
    };

    (PtySession.create as any).mockResolvedValue(mockSession);
    
    await orchestrator.createSession(config, mockSandbox);
    
    mockDoneDetector.isDone.mockReturnValue(true);
    const dataCallback = (mockSession.onData as any).mock.calls[0][0];
    
    await expect(dataCallback('Task completed.')).rejects.toThrow('Failed to close session on completion: Close failed');
  });

  it('should terminate session when timeout event occurs', async () => {
    const config = {
      agentId: 'test-agent',
      model: 'gpt-4',
      temperature: 0.7,
      systemPrompt: 'You are a helpful assistant',
      cliArgs: ['--verbose'],
    };

    const mockSession = {
      onData: vi.fn(),
      onTimeout: vi.fn(),
      write: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
      getScreenState: vi.fn(),
    };

    (PtySession.create as any).mockResolvedValue(mockSession);
    
    await orchestrator.createSession(config, mockSandbox);
    
    // Simulate timeout event
    const timeoutCallback = (mockSession.onTimeout as any).mock.calls[0][0];
    await timeoutCallback();
    
    expect(mockSession.close).toHaveBeenCalled();
  });

  it('should throw a descriptive error when session.close fails during timeout', async () => {
    const config = {
      agentId: 'test-agent',
      model: 'gpt-4',
      temperature: 0.7,
      systemPrompt: 'You are a helpful assistant',
      cliArgs: ['--verbose'],
    };

    const mockSession = {
      onData: vi.fn(),
      onTimeout: vi.fn(),
      write: vi.fn(),
      close: vi.fn().mockRejectedValue(new Error('Close failed')),
      getScreenState: vi.fn(),
    };

    (PtySession.create as any).mockResolvedValue(mockSession);
    
    await orchestrator.createSession(config, mockSandbox);
    
    const timeoutCallback = (mockSession.onTimeout as any).mock.calls[0][0];
    
    await expect(timeoutCallback()).rejects.toThrow('Failed to close session on timeout: Close failed');
  });

  it('should ensure robust cleanup of sandbox and session on failure', async () => {
    const config = {
      agentId: 'test-agent',
      model: 'gpt-4',
      temperature: 0.7,
      systemPrompt: 'You are a helpful assistant',
      cliArgs: ['--verbose'],
    };

    const mockSession = {
      onData: vi.fn(),
      onTimeout: vi.fn(),
      write: vi.fn(),
      close: vi.fn().mockRejectedValue(new Error('Cleanup failed')),
      getScreenState: vi.fn(),
      waitForExit: vi.fn().mockRejectedValue(new Error('Session crashed')),
    };

    (PtySession.create as any).mockResolvedValue(mockSession);
    
    await expect(orchestrator.executeSession(config, mockSandbox, 'npm test'))
      .rejects.toThrow('Session crashed');
      
    expect(mockSession.close).toHaveBeenCalled();
  });
});
