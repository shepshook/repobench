import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionOrchestrator } from '../../src/core/services/session-orchestrator';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { PtySession } from '../../src/infrastructure/pty-session';
import { AgentAdapterFactory } from '../../src/core/services/agent-adapter-factory';
import { AgentConfig } from '../../src/core/contracts';

vi.mock('../../src/infrastructure/pty-session');
vi.mock('../../src/core/services/agent-adapter-factory');

describe('PromptHandler Orchestrator Integration', () => {
  let orchestrator: SessionOrchestrator;
  let mockSandbox: Sandbox;
  let mockConfig: AgentConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    orchestrator = new SessionOrchestrator();
    mockSandbox = {
      createSnapshot: vi.fn().mockResolvedValue(undefined),
      restoreSnapshot: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
      destroy: vi.fn().mockResolvedValue(undefined),
      id: 'mock-sandbox',
      config: {},
      getContainer: vi.fn().mockReturnValue({ id: 'mock-container' }),
      isSimulation: false,
      registerSession: vi.fn(),
      unregisterSession: vi.fn(),
    } as unknown as Sandbox;
    mockConfig = {
      agentId: 'test-agent',
      model: 'gpt-4',
      temperature: 0.7,
      systemPrompt: 'You are a helper',
      cliArgs: ['--verbose'],
    };
    (PtySession.create as any).mockResolvedValue({
      onData: vi.fn(),
      onTimeout: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
      waitForExit: vi.fn(),
    });
  });

  it('should create a session that uses PromptHandler based on adapter rules', async () => {
    const mockAdapter = {
      interactionMap: new Map([
        ['Prompt:', 'yes'],
      ]),
      configure: vi.fn(),
    };
    (AgentAdapterFactory.createAdapter as any).mockReturnValue(mockAdapter);

    const session = await orchestrator.createSession(mockConfig, mockSandbox);
    
    expect(PtySession.create).toHaveBeenCalledWith(
      mockSandbox,
      mockAdapter,
      {},
      expect.any(Object) // This should be the PromptHandler
    );
    expect(session).toBeDefined();
  });

  it('should throw an error during session creation if adapter contains invalid regex rules', async () => {
    const mockAdapter = {
      interactionMap: new Map([
        ['[', 'yes'], // Invalid regex
      ]),
      configure: vi.fn(),
    };
    (AgentAdapterFactory.createAdapter as any).mockReturnValue(mockAdapter);

    // Per ARCHITECTURE.md §4.3, setRules should throw on invalid regex,
    // and SessionOrchestrator should bubble this up.
    await expect(orchestrator.createSession(mockConfig, mockSandbox)).rejects.toThrow();
  });
});

