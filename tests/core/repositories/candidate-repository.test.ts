import { CandidateRepository } from '../../../src/core/repositories/candidate-repository';
import { db, reinitDatabase } from '../../../src/infrastructure/persistence/database';
import { Candidate } from '../../../src/core/contracts';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { generateValidUuid, generateValidHash } from '../../helpers/dataset';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

describe('CandidateRepository', () => {
  let repository: CandidateRepository;
  let tempDbPath: string;

  beforeEach(async () => {
    tempDbPath = path.join(os.tmpdir(), `candidate-repo-test-db-${Date.now()}-${Math.random()}.db`);
    await reinitDatabase(tempDbPath);
    repository = new CandidateRepository();
  });

  afterEach(async () => {
    try {
      await fs.unlink(tempDbPath);
    } catch {}
  });

  it('should upsert and retrieve a candidate', () => {
    const candidate: Candidate = {
      id: generateValidUuid(),
      hash: generateValidHash(),
      message: 'feat: add login',
      files: ['src/login.ts'],
      status: 'pending',
      repositoryUrl: 'https://github.com/user/repo',
      repositoryName: 'repo',
      created_at: new Date('2026-05-15T12:00:00Z'),
    };

    repository.upsert(candidate);
    
    const exists = repository.exists(candidate.hash);
    expect(exists).toBe(true);
    
    const all = repository.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual(candidate);
  });

  it('should not return snake_case properties in Candidate entities', () => {
    const candidate: Candidate = {
      id: generateValidUuid(),
      hash: generateValidHash(),
      message: 'feat: add logout',
      files: ['src/logout.ts'],
      status: 'pending',
      repositoryUrl: 'https://github.com/user/repo',
      repositoryName: 'repo',
      created_at: new Date('2026-05-15T12:00:00Z'),
    };
    repository.upsert(candidate);
    
    const all = repository.getAll();
    const candidateObj = all[0];
    const keys = Object.keys(candidateObj);
    
    const snakeCaseKeys = keys.filter(key => key.includes('_'));
    // We allow 'created_at' if it's part of the Candidate interface, but we should check for others like 'repository_url'
    const forbiddenSnakeCaseKeys = snakeCaseKeys.filter(key => key !== 'created_at');
    
    expect(forbiddenSnakeCaseKeys).toHaveLength(0);
  });

  it('should return false for non-existent hash', () => {
    expect(repository.exists('non-existent')).toBe(false);
  });

  it('should perform an upsert when saving a candidate with an existing ID', () => {
    const candidate: Candidate = {
      id: generateValidUuid(),
      hash: generateValidHash(),
      message: 'feat: add login',
      files: ['src/login.ts'],
      status: 'pending',
      repositoryUrl: 'https://github.com/user/repo',
      repositoryName: 'repo',
      created_at: new Date('2026-05-15T12:00:00Z'),
    };

    repository.upsert(candidate);
    
    const updatedCandidate: Candidate = {
      ...candidate,
      message: 'feat: add login (updated)',
      status: 'validated',
    };

    repository.upsert(updatedCandidate);

    const all = repository.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].message).toBe('feat: add login (updated)');
    expect(all[0].status).toBe('validated');
  });

  it('should not create duplicate records for the same candidate ID', () => {
    const id = generateValidUuid();
    const candidate1: Candidate = {
      id: id,
      hash: generateValidHash(),
      message: 'msg 1',
      files: ['f1.ts'],
      status: 'pending',
      repositoryUrl: 'https://github.com/user/repo',
      repositoryName: 'repo',
      created_at: new Date(),
    };
    const candidate2: Candidate = {
      id: id,
      hash: generateValidHash(), // different hash
      message: 'msg 2',
      files: ['f2.ts'],
      status: 'pending',
      repositoryUrl: 'https://github.com/user/repo',
      repositoryName: 'repo',
      created_at: new Date(),
    };

    repository.upsert(candidate1);
    repository.upsert(candidate2);

    const all = repository.getAll();
    expect(all).toHaveLength(1);
  });

}
);
