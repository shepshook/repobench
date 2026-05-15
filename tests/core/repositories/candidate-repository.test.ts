import { CandidateRepository } from '../../../src/core/repositories/candidate-repository';
import { db, initDatabase } from '../../../src/infrastructure/persistence/database';
import { Candidate } from '../../../src/core/contracts';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

describe('CandidateRepository', () => {
  let repository: CandidateRepository;

  beforeAll(() => {
    initDatabase();
  });

  beforeEach(() => {
    db.prepare('DELETE FROM candidates').run();
    repository = new CandidateRepository();
  });

  it('should save and retrieve a candidate', () => {
    const candidate: Candidate = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      hash: 'abc12345',
      message: 'feat: add login',
      files: ['src/login.ts'],
      status: 'pending',
      created_at: new Date('2026-05-15T12:00:00Z'),
    };

    repository.save(candidate);
    
    const exists = repository.exists('abc12345');
    expect(exists).toBe(true);
    
    const all = repository.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual(candidate);
  });

  it('should return false for non-existent hash', () => {
    expect(repository.exists('non-existent')).toBe(false);
  });

  it('should handle duplicate checks', () => {
     const candidate: Candidate = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      hash: 'abc12345',
      message: 'feat: add login',
      files: ['src/login.ts'],
      status: 'pending',
      created_at: new Date('2026-05-15T12:00:00Z'),
    };
    repository.save(candidate);
    expect(repository.exists('abc12345')).toBe(true);
  });
});
