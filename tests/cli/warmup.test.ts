import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SqliteCandidateRepository } from '../../src/core/repositories/candidate-repo';
import { SandboxFactory } from '../../src/sandbox';
import { Config } from '../../src/core/config';
import { warmupCandidates } from '../../src/cli/warmup-logic';

vi.mock('../../src/core/repositories/candidate-repo', () => {
  return {
    SqliteCandidateRepository: vi.fn(),
  };
});
vi.mock('../../src/sandbox');
vi.mock('../../src/core/config');

describe('warmupCandidates', () => {
  let mockRepo: any;
  let mockSandbox: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSandbox = {
      init: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
    };

    (SandboxFactory.create as any).mockReturnValue(mockSandbox);

    mockRepo = {
      findAll: vi.fn(),
    };
    (SqliteCandidateRepository as any).mockImplementation(function() {
      return mockRepo;
    });

    (Config.load as any).mockReturnValue({
      sandbox: {
        build_command: 'npm run build',
        test_command: 'npm test',
        env_vars: {},
        cache_paths: {},
      },
    });
  });

  it('should warmup all candidates', async () => {
    const candidates = [
      { hash: 'h1', message: 'm1', files: [], status: 'pending', metadata: {} },
      { hash: 'h2', message: 'm2', files: [], status: 'pending', metadata: {} },
    ];
    mockRepo.findAll = vi.fn().mockResolvedValue(candidates);

    await warmupCandidates();

    expect(mockRepo.findAll).toHaveBeenCalled();
    expect(SandboxFactory.create).toHaveBeenCalledTimes(2);
    expect(mockSandbox.init).toHaveBeenCalledTimes(2);
    expect(mockSandbox.destroy).toHaveBeenCalledTimes(2);
  });

  it('should handle no candidates gracefully', async () => {
    mockRepo.findAll = vi.fn().mockResolvedValue([]);

    await warmupCandidates();

    expect(SandboxFactory.create).not.toHaveBeenCalled();
  });

  it('should respect concurrency limit', async () => {
    const candidates = Array.from({ length: 5 }, (_, i) => ({
      hash: `h${i}`, message: `m${i}`, files: [], status: 'pending', metadata: {},
    }));
    mockRepo.findAll = vi.fn().mockResolvedValue(candidates);

    // Use a promise that takes time to resolve to verify concurrency
    let activeSandboxes = 0;
    let maxActiveSandboxes = 0;

    mockSandbox.init = vi.fn().mockImplementation(async () => {
      activeSandboxes++;
      maxActiveSandboxes = Math.max(maxActiveSandboxes, activeSandboxes);
      await new Promise(resolve => setTimeout(resolve, 10));
      activeSandboxes--;
    });

    // We need a way to create DIFFERENT sandbox mocks for each call to track concurrency properly
    (SandboxFactory.create as any).mockImplementation(() => ({
      init: mockSandbox.init,
      destroy: vi.fn().mockResolvedValue(undefined),
    }));

    await warmupCandidates();

    expect(maxActiveSandboxes).toBeLessThanOrEqual(3);
  });
});
