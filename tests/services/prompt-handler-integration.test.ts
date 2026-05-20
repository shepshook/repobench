import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionOrchestrator } from '../../src/core/services/session-orchestrator';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { PtySession } from '../../src/infrastructure/pty-session';
import { AgentAdapterFactory } from '../../src/core/services/agent-adapter-factory';
import { AgentConfig } from '../../src/core/contracts';

vi.mock('../../infrastructure/pty-session');
vi.mock('../../infrastructure/sandbox');
vi.mock('../../src/core/services/agent-adapter-factory');

describe('PromptHandler Orchestrator Integration', () => {
  let orchestrator: SessionOrchestrator;
  let mockSandbox: Sandbox;
  let mockConfig: AgentConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    orchestrator = new SessionOrchestrator();
    mockSandbox = new Sandbox({} as any);
    mockConfig = {
      agentId: 'test-agent',
      model: 'gpt-4',
      temperature: 0.7,
      systemPrompt: 'You are a helper',
      cliArgs: ['--verbose'],
    };
  });

  it('should create a session that uses PromptHandler based on adapter rules', async () => {
    const mockAdapter = {
      interactionMap: new Map([
        ['Prompt:', 'yes'],
      ]),
    };
    (AgentAdapterFactory.createAdapter as any).mockReturnValue(mockAdapter);

    const session = await orchestrator.createSession(mockConfig, mockSandbox);
    
    expect(PtySession.create).toHaveBeenCalledWith(
      mockSandbox,
      mockAdapter,
      { args: mockConfig.cliArgs },
      expect.any(Object) // This should be the PromptHandler
    );
    expect(session).toBeDefined();
  });

  it('should throw an error during session creation if adapter contains invalid regex rules', async () => {
    const mockAdapter = {
      interactionMap: new Map([
        ['[', 'yes'], // Invalid regex
      ]),
    };
    (AgentAdapterFactory.createAdapter as any).mockReturnValue(mockAdapter);

    // Per ARCHITECTURE.md §4.3, setRules should throw on invalid regex,
    // and SessionOrchestrator should bubble this up.
    await expect(orchestrator.createSession(mockConfig, mockSandbox)).rejects.toThrow();
  });
});

