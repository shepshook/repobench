import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JsonlDatasetExporter } from '../../src/infrastructure/jsonl-dataset-exporter';
import { CandidateRepository } from '../../src/core/repositories/candidate-repository';
import { reinitDatabase } from '../../src/infrastructure/persistence/database';
import { CandidateExportSchema } from '../../src/core/contracts';
import { generateValidUuid, generateValidHash } from '../helpers/dataset';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { db } from '../../src/infrastructure/persistence/database';

describe('JsonlDatasetExporter Integration', () => {
  let exporter: JsonlDatasetExporter;
  let repo: CandidateRepository;
  let tempFile: string;
  let tempDbPath: string;

  beforeEach(async () => {
    tempDbPath = path.join(os.tmpdir(), `integration-export-infra-db-${Date.now()}-${Math.random()}.db`);
    await reinitDatabase(tempDbPath);
    
    repo = new CandidateRepository();
    // @ts-ignore - class doesn't exist yet
    exporter = new JsonlDatasetExporter(repo);
    tempFile = path.join(os.tmpdir(), `integration-export-${Date.now()}.jsonl`);
  });

  afterEach(async () => {
    try {
      await fs.unlink(tempFile);
    } catch {}
    try {
      await fs.unlink(tempDbPath);
    } catch {}
  });

  it('should export curated candidates with actual repository and curation data (no placeholders)', async () => {
    const id = generateValidUuid();
    const hash = generateValidHash();
    const pre = generateValidHash();
    const post = generateValidHash();
    const testCandidate = {
      id: id,
      hash: hash,
      message: 'Fix critical bug in parser',
      files: ['src/parser.ts'],
      status: 'curated' as const,
      created_at: new Date(),
      curation: { score: 0.95, reasoning: 'Actually a good fix', isApproved: true },
      repositoryUrl: 'https://github.com/actual/repo',
      repositoryName: 'actual-repo',
      preFixHash: pre,
      postFixHash: post,
    };

    repo.save(testCandidate);

    await exporter.export(tempFile);

    const content = await fs.readFile(tempFile, 'utf-8');
    const parsed = JSON.parse(content.split('\n').filter(l => l.trim())[0]);

    expect(parsed.repository.url).toBe('https://github.com/actual/repo');
    expect(parsed.repository.name).toBe('actual-repo');
    expect(parsed.preFixHash).toBe(pre);
    expect(parsed.postFixHash).toBe(post);
    expect(parsed.curation.score).toBe(0.95);
    expect(parsed.curation.reasoning).toBe('Actually a good fix');
  });

  it('should only export candidates that are curated AND approved', async () => {
    const idApp = generateValidUuid();
    const idRej = generateValidUuid();
    const idPen = generateValidUuid();
    const curatedApproved = {
      id: idApp,
      hash: generateValidHash(),
      message: 'cur-app',
      files: [],
      status: 'curated' as const,
      created_at: new Date(),
      curation: { score: 0.9, reasoning: 'OK', isApproved: true },
      repositoryUrl: 'https://github.com/u/r1',
      repositoryName: 'r1',
      preFixHash: generateValidHash(),
      postFixHash: generateValidHash(),
    };
    const curatedRejected = {
      id: idRej,
      hash: generateValidHash(),
      message: 'cur-rej',
      files: [],
      status: 'curated' as const,
      created_at: new Date(),
      curation: { score: 0.1, reasoning: 'NO', isApproved: false },
      repositoryUrl: 'https://github.com/u/r2',
      repositoryName: 'r2',
      preFixHash: generateValidHash(),
      postFixHash: generateValidHash(),
    };
    const pending = {
      id: idPen,
      hash: generateValidHash(),
      message: 'pen',
      files: [],
      status: 'pending' as const,
      created_at: new Date(),
    };

    repo.save(curatedApproved);
    repo.save(curatedRejected);
    repo.save(pending);

    await exporter.export(tempFile);

    const content = await fs.readFile(tempFile, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).metadata.candidateId).toBe(idApp);
  });

  it('should only export candidates with status "curated"', async () => {
    const idCur = generateValidUuid();
    const idPen = generateValidUuid();
    const curated = {
      id: idCur,
      hash: generateValidHash(),
      message: 'cur',
      files: [],
      status: 'curated' as const,
      created_at: new Date(),
      curation: { score: 0.9, reasoning: 'OK', isApproved: true },
      repositoryUrl: 'https://github.com/u/r4',
      repositoryName: 'r4',
      preFixHash: generateValidHash(),
      postFixHash: generateValidHash(),
    };
    const pending = {
      id: idPen,
      hash: generateValidHash(),
      message: 'pen',
      files: [],
      status: 'pending' as const,
      created_at: new Date(),
    };

    repo.save(curated);
    repo.save(pending);

    await exporter.export(tempFile);

    const content = await fs.readFile(tempFile, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).metadata.candidateId).toBe(idCur);
  });

  it('should NOT export candidates with status "validated" if they are not "curated"', async () => {
    const validatedNotCurated = {
      id: generateValidUuid(),
      hash: generateValidHash(),
      message: 'val-not-cur',
      files: [],
       status: 'validated' as const,
      created_at: new Date(),
      curation: { score: 0.5, reasoning: 'Still reviewing', isApproved: true },
      repositoryUrl: 'https://github.com/u/r3',
      repositoryName: 'r3',
      preFixHash: generateValidHash(),
      postFixHash: generateValidHash(),
    };

    repo.save(validatedNotCurated);

    await exporter.export(tempFile);

    const content = await fs.readFile(tempFile, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    expect(lines).toHaveLength(0);
  });
});
