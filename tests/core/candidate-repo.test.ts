import { describe, it, expect, beforeEach } from 'vitest';
import { SqliteCandidateRepository } from '../../src/core/repositories/candidate-repo';
import { CommitCandidate } from '../../src/types/contracts';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = '.repobench/candidates.db';

describe('SqliteCandidateRepository', () => {
  let repo: SqliteCandidateRepository;

  beforeEach(async () => {
    if (repo) {
      await repo.close();
    }
    if (fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
    }
    repo = new SqliteCandidateRepository();
  });

  it('should save many candidates and find them all', async () => {
    const candidates: CommitCandidate[] = [
      { hash: 'abc1', message: 'fix 1', files: ['f1.ts'], status: 'pending', metadata: {} },
      { hash: 'abc2', message: 'fix 2', files: ['f2.ts'], status: 'pending', metadata: {} },
    ];

    await repo.saveMany(candidates);
    const all = await repo.findAll();
    expect(all).toHaveLength(2);
    expect(all).toEqual(expect.arrayContaining(candidates));
  });

  it('should find candidates by status', async () => {
    const candidates: CommitCandidate[] = [
      { hash: 's1', message: 'm1', files: [], status: 'pending', metadata: {} },
      { hash: 's2', message: 'm2', files: [], status: 'validated', metadata: {} },
      { hash: 's3', message: 'm3', files: [], status: 'pending', metadata: {} },
    ];

    await repo.saveMany(candidates);
    const pending = await repo.findByStatus('pending');
    expect(pending).toHaveLength(2);
    expect(pending.map(c => c.hash)).toContain('s1');
    expect(pending.map(c => c.hash)).toContain('s3');
  });

  it('should update status of a candidate', async () => {
    const candidate: CommitCandidate = { hash: 'u1', message: 'm1', files: [], status: 'pending', metadata: {} };
    await repo.saveMany([candidate]);
    
    await repo.updateStatus('u1', 'validated');
    
    const validated = await repo.findByStatus('validated');
    expect(validated).toHaveLength(1);
    expect(validated[0].hash).toBe('u1');
    
    const pending = await repo.findByStatus('pending');
    expect(pending).toHaveLength(0);
  });

  it('should clear all candidates', async () => {
    await repo.saveMany([
      { hash: 'c1', message: 'm1', files: [], status: 'pending', metadata: {} },
      { hash: 'c2', message: 'm2', files: [], status: 'pending', metadata: {} },
    ]);
    
    await repo.clear();
    const all = await repo.findAll();
    expect(all).toHaveLength(0);
  });
});
