import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionOrchestrator } from '../../src/core/services/session-orchestrator';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { PtySession } from '../../src/infrastructure/pty-session';
import { AgentAdapterFactory } from '../../src/core/services/agent-adapter-factory';

vi.mock('../../src/infrastructure/pty-session');
vi.mock('../../src/infrastructure/sandbox');
vi.mock('../../src/core/services/agent-adapter-factory');

describe('Session Rollback Mechanism', () => {
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
      config: { envVars: {} },
      initialized: true,
    } as any;

    mockSession = {
      onData: vi.fn(),
      write: vi.fn(),
      onTimeout: vi.fn(),
      close: vi.fn(),
      waitForExit: vi.fn().mockResolvedValue(0),
    };

    (PtySession.create as any).mockResolvedValue(mockSession);
    (AgentAdapterFactory.createAdapter as any).mockReturnValue({
      interactionMap: new Map(),
      getStartupCommand: () => 'agent-cli',
    });
  });

  it('should rollback to previous snapshot when a build failure occurs after an auto-approved edit', async () => {
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

    const result = await orchestrator.executeSession(config, mockSandbox, 'npm run build');

    expect(result.success).toBe(false);
    expect(mockSandbox.createSnapshot).toHaveBeenCalled();
    expect(mockSandbox.restoreSnapshot).toHaveBeenCalled();
    expect(mockSession.close).toHaveBeenCalled();
  });

  it('should not rollback if the build succeeds', async () => {
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

    const result = await orchestrator.executeSession(config, mockSandbox, 'npm run build');

    expect(result.success).toBe(true);
    expect(mockSandbox.restoreSnapshot).not.toHaveBeenCalled();
    expect(mockSession.close).toHaveBeenCalled();
  });
});
