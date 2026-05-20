import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionOrchestrator } from '../../src/core/services/session-orchestrator';
import { PtySession } from '../../src/infrastructure/pty-session';
import { AgentAdapterFactory } from '../../src/core/services/agent-adapter-factory';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { PromptHandler } from '../../src/core/services/prompt-handler';

vi.mock('../../src/infrastructure/pty-session');
vi.mock('../../src/core/services/agent-adapter-factory');

describe('SessionOrchestrator Integration', () => {
  let orchestrator: SessionOrchestrator;
  let mockSandbox: Sandbox;

  beforeEach(() => {
    vi.clearAllMocks();
    orchestrator = new SessionOrchestrator();
    mockSandbox = {} as Sandbox;
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

    // This test expects that SessionOrchestrator is responsible for 
    // hooking up the PromptHandler to the session's data stream.
    // Currently, this will FAIL because SessionOrchestrator just calls PtySession.create 
    // and doesn't perform any PromptHandler integration itself.
    expect(mockSession.onData).toHaveBeenCalled();
    
    // Verify that a PromptHandler is actually used to handle the data
    const dataCallback = (mockSession.onData as any).mock.calls[0][0];
    const promptHandler = new PromptHandler();
    promptHandler.setRules([{ pattern: 'Confirm\\? \\[y/n\\]', response: 'y' }]);
    
    // We simulate the data callback being called (which the orchestrator should have set up)
    // and verify that it results in a write to the session.
    // Note: This is a high-level integration test.
    
    // If the orchestrator had integrated PromptHandler, it would have done something like:
    // session.onData(data => { 
    //   const res = promptHandler.handle(data);
    //   if (res) session.write(res);
    // });
    
    // We simulate the prompt being received
    dataCallback('Confirm? [y/n]');
    expect(mockSession.write).toHaveBeenCalledWith('y\n');
  });
});
