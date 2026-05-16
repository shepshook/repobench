import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CandidateRepository } from '../../src/core/repositories/candidate-repository';
import { reinitDatabase } from '../../src/infrastructure/persistence/database';
import { generateValidUuid, generateValidHash } from '../helpers/dataset';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

describe('Database Isolation Failure', () => {
  let repo: CandidateRepository;
  let tempDbPath: string;

  beforeEach(async () => {
    tempDbPath = path.join(os.tmpdir(), `isolation-failure-db-${Date.now()}-${Math.random()}.db`);
    await reinitDatabase(tempDbPath);
    repo = new CandidateRepository();
  });

  afterEach(async () => {
    try {
      await fs.unlink(tempDbPath);
    } catch {}
  });

  it('Test A: inserts data', async () => {
    repo.save({
      id: generateValidUuid(),
      hash: generateValidHash(),
      message: 'data from A',
      files: [],
      status: 'curated' as const,
      created_at: new Date(),
      curation: { score: 0.9, reasoning: 'A', isApproved: true },
      repositoryUrl: 'https://github.com/a/repo',
      repositoryName: 'repo-a',
      preFixHash: generateValidHash(),
      postFixHash: generateValidHash(),
    });
    expect(repo.getAll()).toHaveLength(1);
  });

  it('Test B: expects empty database', async () => {
    // If isolation is working (e.g. via reinitDatabase in beforeEach), this should be 0.
    // If isolation is failing (shared DB), this will be 1 because Test A ran before it.
    expect(repo.getAll()).toHaveLength(0);
  });
});
