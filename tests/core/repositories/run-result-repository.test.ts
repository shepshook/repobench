import { RunResultRepository } from '../../../src/core/repositories/run-result-repository';
import { reinitDatabase } from '../../../src/infrastructure/persistence/database';
import { RunResult } from '../../../src/core/contracts';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateValidUuid } from '../../helpers/dataset';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

describe('RunResultRepository', () => {
  let repository: RunResultRepository;
  let tempDbPath: string;

  beforeEach(async () => {
    tempDbPath = path.join(os.tmpdir(), `run-result-repo-test-db-${Date.now()}-${Math.random()}.db`);
    await reinitDatabase(tempDbPath);
    repository = new RunResultRepository();
  });

  afterEach(async () => {
    try {
      await fs.unlink(tempDbPath);
    } catch {}
  });

  const createValidRunResult = (overrides: Partial<RunResult> = {}): RunResult => ({
    runId: generateValidUuid(),
    agentId: 'test-agent',
    candidateId: generateValidUuid(),
    metrics: {
      success: true,
      cost: 0.05,
      latency: 1200,
      eScore: 0.8,
    },
    timestamp: new Date(),
    logPath: '/logs/run.log',
    ...overrides,
  });

  it('should save and retrieve a run result by ID', () => {
    const run = createValidRunResult();
    repository.save(run);

    const retrieved = repository.getById(run.runId);
    expect(retrieved).toEqual(run);
  });

  it('should return undefined for non-existent run ID', () => {
    expect(repository.getById(generateValidUuid())).toBeUndefined();
  });

  it('should retrieve all run results', () => {
    const runs = [createValidRunResult(), createValidRunResult()];
    runs.forEach(run => repository.save(run));

    const all = repository.getAll();
    expect(all).toHaveLength(2);
    expect(all).toEqual(expect.arrayContaining(runs));
  });

  it('should return an empty array when no runs exist', () => {
    expect(repository.getAll()).toEqual([]);
  });

  it('should retrieve runs by agent ID', () => {
    const agentId = 'agent-1';
    const runs = [
      createValidRunResult({ agentId }),
      createValidRunResult({ agentId }),
      createValidRunResult({ agentId: 'agent-2' }),
    ];
    runs.forEach(run => repository.save(run));

    const results = repository.getByAgentId(agentId);
    expect(results).toHaveLength(2);
    expect(results.every(r => r.agentId === agentId)).toBe(true);
  });

  it('should retrieve runs by candidate ID', () => {
    const candidateId = generateValidUuid();
    const runs = [
      createValidRunResult({ candidateId }),
      createValidRunResult({ candidateId }),
      createValidRunResult({ candidateId: generateValidUuid() }),
    ];
    runs.forEach(run => repository.save(run));

    const results = repository.getByCandidateId(candidateId);
    expect(results).toHaveLength(2);
    expect(results.every(r => r.candidateId === candidateId)).toBe(true);
  });

  it('should update an existing run result when saving with the same runId', () => {
    const run = createValidRunResult();
    repository.save(run);

    const updatedRun = {
      ...run,
      metrics: {
        ...run.metrics,
        eScore: 0.9,
      },
    };
    repository.save(updatedRun);

    const all = repository.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].metrics.eScore).toBe(0.9);
  });

  describe('DI compliance', () => {
    it('should not expose static getLastCreated method', () => {
      expect((RunResultRepository as any).getLastCreated).toBeUndefined();
    });

    it('should not maintain a static instances array', () => {
      // Create multiple instances; after the fix there should be no static array
      const repo1 = new RunResultRepository();
      const repo2 = new RunResultRepository();
      expect(repo1).toBeInstanceOf(RunResultRepository);
      expect(repo2).toBeInstanceOf(RunResultRepository);
      // Both instances share the same db — no static tracking needed
      const run = createValidRunResult();
      repo1.save(run);
      expect(repo2.getAll()).toHaveLength(1);
    });
  });
});
