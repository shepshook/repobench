import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SandboxStateManager } from '../../src/core/sandbox/state-manager';
import { ISandbox } from '../../src/types/contracts';

describe('SandboxStateManager', () => {
  let mockSandbox: ISandbox;
  let stateManager: SandboxStateManager;

  beforeEach(() => {
    mockSandbox = {
      init: vi.fn(),
      setup: vi.fn(),
      verify: vi.fn(),
      ping: vi.fn(),
      execute: vi.fn(),
      switchToState: vi.fn(),
      destroy: vi.fn(),
      getWorkingDir: vi.fn(),
    } as unknown as ISandbox;

    stateManager = new SandboxStateManager(mockSandbox);
  });

  it('should start with unknown state', () => {
    expect(stateManager.getCurrentState()).toBe('unknown');
  });

  it('should set pre-fix state and call switchToState', async () => {
    const commitHash = 'abc1234';
    await stateManager.setPreFixState(commitHash);

    expect(mockSandbox.switchToState).toHaveBeenCalledWith(commitHash);
    expect(stateManager.getCurrentState()).toBe('pre-fix');
  });

  it('should set post-fix state and call switchToState', async () => {
    const commitHash = 'def5678';
    await stateManager.setPostFixState(commitHash);

    expect(mockSandbox.switchToState).toHaveBeenCalledWith(commitHash);
    expect(stateManager.getCurrentState()).toBe('post-fix');
  });
});
