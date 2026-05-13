import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Session } from '../../src/core/session/session';
import { ISandbox } from '../../src/types/contracts';
import { StateCandidate } from '../../src/sandbox/state-manager';

describe('State Switching Integration', () => {
  let mockSandbox: ISandbox;
  let session: Session;
  let candidate: StateCandidate;

  beforeEach(() => {
    mockSandbox = {
      init: vi.fn().mockResolvedValue(undefined),
      setup: vi.fn().mockResolvedValue(undefined),
      verify: vi.fn().mockResolvedValue(true),
      ping: vi.fn().mockResolvedValue(true),
      execute: vi.fn().mockResolvedValue(''),
      switchToState: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
      getWorkingDir: vi.fn().mockReturnValue('/tmp/sandbox'),
    };

    session = new Session(mockSandbox);

    candidate = {
      preFixHash: 'pre-hash-123',
      postFixHash: 'post-hash-456',
    };
  });

  it('should switch states correctly and avoid redundant switches', async () => {
    // 1. First call: switch to 'pre'
    await session.ensureState('pre', candidate);
    expect(mockSandbox.switchToState).toHaveBeenCalledWith('pre-hash-123');
    expect(mockSandbox.switchToState).toHaveBeenCalledTimes(1);

    // 2. Second call: 'pre' again -> should NOT call switchToState
    await session.ensureState('pre', candidate);
    expect(mockSandbox.switchToState).toHaveBeenCalledTimes(1);

    // 3. Third call: switch to 'post'
    await session.ensureState('post', candidate);
    expect(mockSandbox.switchToState).toHaveBeenCalledWith('post-hash-456');
    expect(mockSandbox.switchToState).toHaveBeenCalledTimes(2);

    // 4. Fourth call: switch back to 'pre'
    await session.ensureState('pre', candidate);
    expect(mockSandbox.switchToState).toHaveBeenCalledWith('pre-hash-123');
    expect(mockSandbox.switchToState).toHaveBeenCalledTimes(3);

    // 5. Fifth call: switch back to 'post'
    await session.ensureState('post', candidate);
    expect(mockSandbox.switchToState).toHaveBeenCalledWith('post-hash-456');
    expect(mockSandbox.switchToState).toHaveBeenCalledTimes(4);
  });
});
