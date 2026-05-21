import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionOrchestrator } from '../../src/core/services/session-orchestrator';
import { PtySession } from '../../src/infrastructure/pty-session';
import { AgentAdapterFactory } from '../../src/core/services/agent-adapter-factory';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { PromptHandler } from '../../src/core/services/prompt-handler';
import { IDoneDetector, ICostParser } from '../../src/core/contracts';

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
      configure: vi.fn(),
    });
    (PtySession.create as any).mockResolvedValue({
      onData: vi.fn(),
      onTimeout: vi.fn(),
      write: vi.fn(),
       close: vi.fn().mockResolvedValue(undefined),
      getScreenState: vi.fn(),
      waitForExit: vi.fn(),
    });
  });

  it('should pass cliArgs from agent config to PtySession.create', async () => {
    const config = {
      agentId: 'test-agent',
      model: 'gpt-4',
      temperature: 0.7,
      systemPrompt: 'You are a helpful assistant',
      cliArgs: ['--model', 'gpt-4', '--temp', '0.7'],
    };
    
    await orchestrator.createSession(config, mockSandbox);
    
    expect(PtySession.create).toHaveBeenCalledWith(
      mockSandbox,
      expect.anything(),
      expect.objectContaining({}),
      expect.anything()
    );
  });

  it('should call createSnapshot on the sandbox during session creation', async () => {
    const config = {
      agentId: 'test-agent',
      model: 'gpt-4',
      temperature: 0.7,
      systemPrompt: 'You are a helpful assistant',
      cliArgs: ['--verbose'],
    };
    
    const mockAdapter = {
      interactionMap: new Map(),
      getStartupCommand: () => 'agent-cli',
      configure: vi.fn(),
    };
    (AgentAdapterFactory.createAdapter as any).mockReturnValue(mockAdapter);

    await orchestrator.createSession(config, mockSandbox);
    expect(mockSandbox.createSnapshot).toHaveBeenCalled();
    expect(mockAdapter.configure).toHaveBeenCalledWith(config);
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
       close: vi.fn().mockResolvedValue(undefined),
      getScreenState: vi.fn(),
    };

    (PtySession.create as any).mockResolvedValue(mockSession);
    (AgentAdapterFactory.createAdapter as any).mockReturnValue({
      interactionMap: new Map([
        [/Confirm\? \[y\/n\]/, 'y']
      ]),
      getStartupCommand: () => 'agent-cli',
      configure: vi.fn(),
    });

    const session = await orchestrator.createSession(config, mockSandbox);

    expect(mockSession.onData).toHaveBeenCalled();
    
    const dataCallback = (mockSession.onData as any).mock.calls[0][0];
    
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

  it('should attempt to close session on completion', async () => {
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
    
    dataCallback('Task completed.');
    expect(mockSession.close).toHaveBeenCalled();
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

  it('should attempt to close session on timeout', async () => {
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
    
    timeoutCallback();
    expect(mockSession.close).toHaveBeenCalled();
  });

  it('should log an error to console when session.close fails during completion', async () => {
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
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    await orchestrator.createSession(config, mockSandbox);
    
    mockDoneDetector.isDone.mockReturnValue(true);
    const dataCallback = (mockSession.onData as any).mock.calls[0][0];
    
    dataCallback('Task completed.');
    
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to close session on completion: Close failed'));
    consoleSpy.mockRestore();
  });

  it('should log an error to console when session.close fails during timeout', async () => {
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
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    await orchestrator.createSession(config, mockSandbox);
    
    const timeoutCallback = (mockSession.onTimeout as any).mock.calls[0][0];
    
    timeoutCallback();
    
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to close session on timeout: Close failed'));
    consoleSpy.mockRestore();
  });

  it('should not return a promise from onData callback', async () => {

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

    const dataCallback = (mockSession.onData as any).mock.calls[0][0];
    const result = dataCallback('some data');
    expect(result).not.toBeInstanceOf(Promise);
  });

  it('should not return a promise from onTimeout callback', async () => {
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

    const timeoutCallback = (mockSession.onTimeout as any).mock.calls[0][0];
    const result = timeoutCallback();
    expect(result).not.toBeInstanceOf(Promise);
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

describe('SessionOrchestrator Cost Integration', () => {
  let orchestrator: SessionOrchestrator;
  let mockCostParser: ICostParser;
  let mockSandbox: Sandbox;
  let mockDoneDetector: IDoneDetector;
  let mockSessionRepository: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDoneDetector = {
      isDone: vi.fn().mockReturnValue(false),
      setSignatures: vi.fn(),
    };
    mockCostParser = {
      parse: vi.fn().mockReturnValue({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        cost: 0.01,
        currency: 'USD',
      }),
    };
    mockSessionRepository = {
      saveCost: vi.fn().mockResolvedValue(undefined),
    };

    // Injecting mockDoneDetector and mockCostParser
    // We use 'as any' because the current implementation might not support these in constructor yet
    orchestrator = new SessionOrchestrator(mockDoneDetector, mockCostParser) as any;
    // Injecting mock repository as well (expected behavior)
    orchestrator.sessionRepository = mockSessionRepository;
    vi.spyOn(console, 'log').mockImplementation(() => {});

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
      configure: vi.fn(),
    });
  });

  it('should accept runId in executeSession and associate costs with it', async () => {
    const config = {
      agentId: 'test-agent',
      model: 'gpt-4',
      temperature: 0.7,
      systemPrompt: 'You are a helpful assistant',
      cliArgs: ['--verbose'],
    };
    const runId = 'test-run-uuid';

    const mockSession = {
      onData: vi.fn(),
      onTimeout: vi.fn(),
      write: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
      getScreenState: vi.fn().mockReturnValue('Prompt tokens: 100, Completion tokens: 50, Cost: 0.01 USD'),
      waitForExit: vi.fn().mockResolvedValue(0),
    };

    (PtySession.create as any).mockResolvedValue(mockSession);

    // This call is expected to fail if runId is not supported
    const result = await orchestrator.executeSession(config, mockSandbox, 'npm test', runId);

    expect(result.cost).toBe(0.01);
    expect(mockSessionRepository.saveCost).toHaveBeenCalledWith(runId, expect.objectContaining({
      cost: 0.01,
    }));
  });

  it('should output a cost summary log after parsing metrics', async () => {
    const config = {
      agentId: 'test-agent',
      model: 'gpt-4',
      temperature: 0.7,
      systemPrompt: 'You are a helpful assistant',
      cliArgs: ['--verbose'],
    };
    const runId = 'test-run-uuid';

    const mockSession = {
      onData: vi.fn(),
      onTimeout: vi.fn(),
      write: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
      getScreenState: vi.fn().mockReturnValue('Prompt tokens: 100, Completion tokens: 50, Cost: 0.01 USD'),
      waitForExit: vi.fn().mockResolvedValue(0),
    };

    (PtySession.create as any).mockResolvedValue(mockSession);

    await orchestrator.executeSession(config, mockSandbox, 'npm test', runId);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('[Cost Summary] Run: test-run-uuid, Total Tokens: 150, Cost: 0.01 USD')
    );
  });

  it('should parse costs from session logs and return them in the result', async () => {
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
      getScreenState: vi.fn().mockReturnValue('Prompt tokens: 100, Completion tokens: 50, Cost: 0.01 USD'),
      waitForExit: vi.fn().mockResolvedValue(0),
    };

    (PtySession.create as any).mockResolvedValue(mockSession);

    const result = await orchestrator.executeSession(config, mockSandbox, 'npm test');

    expect(result.cost).toBe(0.01);
    expect(mockCostParser.parse).toHaveBeenCalledWith(mockSession.getScreenState());
  });

  it('should correctly integrate with a real CostParser to extract costs from session state', async () => {
    const { CostParser } = await import('../../src/core/services/cost-parser');
    const realCostParser = new CostParser();
    const orchestratorWithRealParser = new SessionOrchestrator(mockDoneDetector, realCostParser) as any;
    orchestratorWithRealParser.sessionRepository = mockSessionRepository;

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
      getScreenState: vi.fn().mockReturnValue('Total tokens used: 168 (123 prompt, 45 completion). Cost: $0.012'),
      waitForExit: vi.fn().mockResolvedValue(0),
    };

    (PtySession.create as any).mockResolvedValue(mockSession);

    const result = await orchestratorWithRealParser.executeSession(config, mockSandbox, 'npm test');

    expect(result.cost).toBe(0.012);
    expect(mockSessionRepository.saveCost).toHaveBeenCalledWith(undefined, expect.objectContaining({
      cost: 0.012,
    }));
  });
});
