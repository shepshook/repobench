import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database, db } from '../../src/infrastructure/persistence/database';
import { CandidateRepository } from '../../src/core/repositories/candidate-repository';
import { RunResultRepository } from '../../src/core/repositories/run-result-repository';
import { Candidate, IDatabase, RunResult } from '../../src/core/contracts';
import { generateValidUuid, generateValidHash } from '../helpers/dataset';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import fsp from 'node:fs/promises';

describe('Database.init() — path-based initialization', () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-init-test-'));
    dbPath = path.join(tempDir, 'nested', 'repobench.db');
  });

  afterEach(async () => {
    try {
      await fsp.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('should create a database file at the specified dbPath', () => {
    Database.init({ dbPath });
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  it('should create the parent directory when it does not exist', () => {
    const deepPath = path.join(tempDir, 'a', 'b', 'c', 'deep.db');
    Database.init({ dbPath: deepPath });
    expect(fs.existsSync(deepPath)).toBe(true);
  });

  it('should not fall back to CWD-relative repobench.db', () => {
    Database.init({ dbPath });
    const cwdFallback = path.resolve(process.cwd(), 'repobench.db');
    expect(fs.existsSync(cwdFallback)).toBe(false);
  });

  it('should throw when dbPath is omitted', () => {
    expect(() => (Database.init as () => void)()).toThrow();
  });

  it('should throw when dbPath is an empty string', () => {
    expect(() => Database.init({ dbPath: '' })).toThrow();
  });
});

describe('Database.init() — schema initialization', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-schema-init-'));
  });

  afterEach(async () => {
    try {
      await fsp.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('should create the candidates table', () => {
    const result = Database.init({ dbPath: path.join(tempDir, 'test.db') });
    const rows = result.prepare<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='candidates'"
    ).all();
    expect(rows).toHaveLength(1);
  });

  it('should create the runs table', () => {
    const result = Database.init({ dbPath: path.join(tempDir, 'test.db') });
    const rows = result.prepare<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='runs'"
    ).all();
    expect(rows).toHaveLength(1);
  });

  it('should create the containers table', () => {
    const result = Database.init({ dbPath: path.join(tempDir, 'test.db') });
    const rows = result.prepare<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='containers'"
    ).all();
    expect(rows).toHaveLength(1);
  });

  it('should be idempotent when called multiple times', () => {
    const p = path.join(tempDir, 'test.db');
    Database.init({ dbPath: p });
    expect(() => Database.init({ dbPath: p })).not.toThrow();
  });

  it('should return an IDatabase-compatible object', () => {
    const result = Database.init({ dbPath: path.join(tempDir, 'test.db') });
    expect(result).toHaveProperty('prepare');
    expect(result).toHaveProperty('run');
    expect(typeof result.prepare).toBe('function');
    expect(typeof result.run).toBe('function');
  });
});

describe('Database.init() — repository operations work identically', () => {
  let tempDir: string;
  let candidateRepo: CandidateRepository;
  let runResultRepo: RunResultRepository;
  let database: IDatabase;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-repo-test-'));
    database = Database.init({ dbPath: path.join(tempDir, 'repobench.db') });
    candidateRepo = new CandidateRepository();
    runResultRepo = new RunResultRepository(db);
  });

  afterEach(async () => {
    try {
      await fsp.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('should support CandidateRepository upsert and query', () => {
    const candidate: Candidate = {
      id: generateValidUuid(),
      hash: generateValidHash(),
      message: 'fix: resolve database init path',
      files: ['src/infrastructure/persistence/database.ts'],
      status: 'pending',
      created_at: new Date(),
    };
    candidateRepo.upsert(candidate);
    expect(candidateRepo.exists(candidate.hash)).toBe(true);
    const retrieved = candidateRepo.getById(candidate.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(candidate.id);
    expect(retrieved!.message).toBe('fix: resolve database init path');
  });

  it('should support CandidateRepository getAll after upserting multiple items', () => {
    const c1: Candidate = {
      id: generateValidUuid(), hash: generateValidHash(), message: 'fix a',
      files: ['a.ts'], status: 'pending', created_at: new Date(),
    };
    const c2: Candidate = {
      id: generateValidUuid(), hash: generateValidHash(), message: 'fix b',
      files: ['b.ts'], status: 'pending', created_at: new Date(),
    };
    candidateRepo.upsert(c1);
    candidateRepo.upsert(c2);
    const all = candidateRepo.getAll();
    expect(all).toHaveLength(2);
    expect(all.map(c => c.id)).toEqual(expect.arrayContaining([c1.id, c2.id]));
  });

  it('should support RunResultRepository save and getById', () => {
    const run: RunResult = {
      runId: generateValidUuid(),
      agentId: 'test-agent',
      candidateId: generateValidUuid(),
      metrics: { success: true, cost: 0.1, latency: 500, eScore: 0.9 },
      timestamp: new Date(),
    };
    runResultRepo.save(run);
    const retrieved = runResultRepo.getById(run.runId);
    expect(retrieved).toBeDefined();
    expect(retrieved!.runId).toBe(run.runId);
    expect(retrieved!.metrics.eScore).toBe(0.9);
  });

  it('should support RunResultRepository getByAgentId and getByCandidateId', () => {
    const agentId = 'agent-alpha';
    const candidateId = generateValidUuid();
    const runs: RunResult[] = [
      { runId: generateValidUuid(), agentId, candidateId: generateValidUuid(), metrics: { success: true, cost: 0.1, latency: 100, eScore: 0.8 }, timestamp: new Date() },
      { runId: generateValidUuid(), agentId, candidateId, metrics: { success: false, cost: 0.2, latency: 200, eScore: 0.6 }, timestamp: new Date() },
      { runId: generateValidUuid(), agentId: 'other', candidateId: generateValidUuid(), metrics: { success: true, cost: 0.1, latency: 100, eScore: 0.8 }, timestamp: new Date() },
    ];
    runs.forEach(r => runResultRepo.save(r));
    expect(runResultRepo.getByAgentId(agentId)).toHaveLength(2);
    expect(runResultRepo.getByCandidateId(candidateId)).toHaveLength(1);
  });

  it('should support RunResultRepository getAll with no results', () => {
    expect(runResultRepo.getAll()).toEqual([]);
  });

  it('should allow both repositories to operate on the same database instance', () => {
    const candidateId = generateValidUuid();
    const candidate: Candidate = {
      id: candidateId, hash: generateValidHash(), message: 'shared',
      files: ['shared.ts'], status: 'pending', created_at: new Date(),
    };
    candidateRepo.upsert(candidate);
    expect(candidateRepo.exists(candidate.hash)).toBe(true);

    const run: RunResult = {
      runId: generateValidUuid(), agentId: 'test', candidateId,
      metrics: { success: true, cost: 0.05, latency: 100, eScore: 0.95 },
      timestamp: new Date(),
    };
    runResultRepo.save(run);
    const byCandidate = runResultRepo.getByCandidateId(candidateId);
    expect(byCandidate).toHaveLength(1);
    expect(byCandidate[0].candidateId).toBe(candidateId);
  });
});
