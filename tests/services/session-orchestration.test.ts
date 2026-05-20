import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionOrchestrator } from '../../src/core/services/session-orchestrator';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { PtySession } from '../../src/infrastructure/pty-session';
import { AgentAdapterFactory } from '../../src/core/services/agent-adapter-factory';

vi.mock('../../src/infrastructure/pty-session');
vi.mock('../../src/infrastructure/sandbox');
vi.mock('../../src/core/services/agent-adapter-factory');

describe('Session Orchestration Integration', () => {
  let orchestrator: SessionOrchestrator;
  let mockSandbox: Sandbox;
  let mockSession: any;

  beforeEach(() => {
    vi.clearAllMocks();
    orchestrator = new SessionOrchestrator();
    
    mockSandbox = {
      createSnapshot: vi.fn().mockResolvedValue(undefined),
      restoreSnapshot: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn(),
      config: { envVars: {}, buildCommand: 'npm run build' },
      initialized: true,
    } as any;

    mockSession = {
      write: vi.fn().mockResolvedValue(true),
      close: vi.fn().mockResolvedValue(undefined),
      waitForExit: vi.fn().mockResolvedValue(0),
    };

    (PtySession.create as any).mockResolvedValue(mockSession);
    (AgentAdapterFactory.createAdapter as any).mockReturnValue({
      interactionMap: new Map(),
      getStartupCommand: () => 'agent-cli',
    });
  });

  it('should rollback and return success: false when build fails during executeSession', async () => {
    const config = {
      agentId: 'test-agent',
      model: 'gpt-4',
      temperature: 0.7,
      systemPrompt: 'You are a helper',
      cliArgs: [],
    };

    // Simulate build failure
    mockSandbox.execute.mockResolvedValue({
      stdout: 'Build failed',
      stderr: 'Error: type mismatch',
      exitCode: 1,
    });

    // This call should fail because executeSession is not yet implemented/exposed
    const result = await (orchestrator as any).executeSession(config, mockSandbox, 'npm run build');

    expect(result.success).toBe(false);
    expect(mockSandbox.createSnapshot).toHaveBeenCalled();
    expect(mockSandbox.restoreSnapshot).toHaveBeenCalled();
    expect(mockSession.close).toHaveBeenCalled();
  });

  it('should not rollback and return success: true when build succeeds during executeSession', async () => {
    const config = {
      agentId: 'test-agent',
      model: 'gpt-4',
      temperature: 0.7,
      systemPrompt: 'You are a helper',
      cliArgs: [],
    };

    // Simulate build success
    mockSandbox.execute.mockResolvedValue({
      stdout: 'Build successful',
      stderr: '',
      exitCode: 0,
    });

    const result = await (orchestrator as any).executeSession(config, mockSandbox, 'npm run build');

    expect(result.success).toBe(true);
    expect(mockSandbox.restoreSnapshot).not.toHaveBeenCalled();
    expect(mockSession.close).toHaveBeenCalled();
  });
});
