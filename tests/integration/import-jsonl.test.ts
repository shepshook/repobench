import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JsonlDatasetImporter } from '../../src/infrastructure/jsonl-dataset-importer';
import { CandidateRepository } from '../../src/core/repositories/candidate-repository';
import { reinitDatabase, getRawDb } from '../../src/infrastructure/persistence/database';
import { generateValidUuid, generateValidHash } from '../helpers/dataset';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('JsonlDatasetImporter Integration', () => {
  let importer: JsonlDatasetImporter;
  let repo: CandidateRepository;
  let tempFile: string;
  let tempDbPath: string;

  beforeEach(async () => {
    tempDbPath = path.join(os.tmpdir(), `integration-import-db-${Date.now()}-${Math.random()}.db`);
    await reinitDatabase(tempDbPath);
    getRawDb().prepare('DELETE FROM candidates').run();
    
    repo = new CandidateRepository();
    // @ts-ignore - class doesn't exist yet
    importer = new JsonlDatasetImporter(repo);
    tempFile = path.join(os.tmpdir(), `integration-import-${Date.now()}.jsonl`);
  });

  afterEach(async () => {
    try {
      await fs.unlink(tempFile);
    } catch {}
    try {
      await fs.unlink(tempDbPath);
    } catch {}
  });

  it('should correctly import candidates into the database from a valid JSONL file', async () => {
    const id1 = generateValidUuid();
    const id2 = generateValidUuid();
    const pre1 = generateValidHash();
    const post1 = generateValidHash();
    const pre2 = generateValidHash();
    const post2 = generateValidHash();
    const mockData = [
      {
        repository: { url: 'https://github.com/user/repo1', name: 'repo1' },
        preFixHash: pre1,
        postFixHash: post1,
        curation: { score: 0.9, reasoning: 'Good', isApproved: true },
        status: 'validated',
        metadata: { candidateId: id1, createdAt: new Date().toISOString() },
      },
      {
        repository: { url: 'https://github.com/user/repo2', name: 'repo2' },
        preFixHash: pre2,
        postFixHash: post2,
        curation: { score: 0.8, reasoning: 'Okay', isApproved: true },
        status: 'validated',
        metadata: { candidateId: id2, createdAt: new Date().toISOString() },
      },
    ];

    await fs.writeFile(tempFile, mockData.map(d => JSON.stringify(d)).join('\n'));

    await importer.import(tempFile);

    const allCandidates = repo.getAll();
    expect(allCandidates.find(c => c.id === id1)).toBeDefined();
    expect(allCandidates.find(c => c.id === id2)).toBeDefined();
    
    const candidate1 = allCandidates.find(c => c.id === id1);
    expect(candidate1?.repositoryUrl).toBe('https://github.com/user/repo1');
    expect(candidate1?.preFixHash).toBe(pre1);
    expect(candidate1?.postFixHash).toBe(post1);
  });

  it('should not create duplicate entries when a single file contains multiple entries with the same candidateId', async () => {
    const id = generateValidUuid();
    const pre = generateValidHash();
    const post = generateValidHash();
    const mockData = [
      {
        repository: { url: 'https://github.com/user/repo1', name: 'repo1' },
        preFixHash: pre,
        postFixHash: post,
        curation: { score: 0.9, reasoning: 'Good', isApproved: true },
        status: 'validated',
        metadata: { candidateId: id, createdAt: new Date().toISOString() },
      },
      {
        repository: { url: 'https://github.com/user/repo1', name: 'repo1' },
        preFixHash: pre,
        postFixHash: post,
        curation: { score: 0.9, reasoning: 'Good', isApproved: true },
        status: 'validated',
        metadata: { candidateId: id, createdAt: new Date().toISOString() },
      },
    ];

    await fs.writeFile(tempFile, mockData.map(d => JSON.stringify(d)).join('\n'));

    await importer.import(tempFile);

    const matches = repo.getAll().filter(c => c.id === id);
    expect(matches).toHaveLength(1);
  });

  it('should not create duplicate entries when importing the same file multiple times (version 2)', async () => {
    const id = generateValidUuid();
    const pre = generateValidHash();
    const post = generateValidHash();
    const mockData = [
      {
        repository: { url: 'https://github.com/user/repo1', name: 'repo1' },
        preFixHash: pre,
        postFixHash: post,
        curation: { score: 0.9, reasoning: 'Good', isApproved: true },
        status: 'validated',
        metadata: { candidateId: id, createdAt: new Date().toISOString() },
      },
    ];

    await fs.writeFile(tempFile, mockData.map(d => JSON.stringify(d)).join('\n'));

    // First import
    await importer.import(tempFile);
    expect(repo.getAll()).toHaveLength(1);

    // Second import
    await importer.import(tempFile);
    expect(repo.getAll()).toHaveLength(1);
  });



  it('should not create duplicate entries when importing the same file multiple times', async () => {
    const id = generateValidUuid();
    const pre = generateValidHash();
    const post = generateValidHash();
    const mockData = [
      {
        repository: { url: 'https://github.com/user/repo1', name: 'repo1' },
        preFixHash: pre,
        postFixHash: post,
        curation: { score: 0.9, reasoning: 'Good', isApproved: true },
        status: 'validated',
        metadata: { candidateId: id, createdAt: new Date().toISOString() },
      },
    ];

    await fs.writeFile(tempFile, mockData.map(d => JSON.stringify(d)).join('\n'));

    // First import
    await importer.import(tempFile);
    expect(repo.getAll()).toHaveLength(1);

    // Second import
    await importer.import(tempFile);
    expect(repo.getAll()).toHaveLength(1);
  });

  it('should not create duplicate entries when importing the same file concurrently', async () => {
    const id = generateValidUuid();
    const pre = generateValidHash();
    const post = generateValidHash();
    const mockData = [
      {
        repository: { url: 'https://github.com/user/repo1', name: 'repo1' },
        preFixHash: pre,
        postFixHash: post,
        curation: { score: 0.9, reasoning: 'Good', isApproved: true },
        status: 'validated',
        metadata: { candidateId: id, createdAt: new Date().toISOString() },
      },
    ];

    await fs.writeFile(tempFile, mockData.map(d => JSON.stringify(d)).join('\n'));

    await Promise.all([
      importer.import(tempFile),
      importer.import(tempFile),
      importer.import(tempFile),
    ]);

    const matches = repo.getAll().filter(c => c.id === id);
    expect(matches).toHaveLength(1);
  });

  it('should handle complex overlapping candidates across multiple files (upsert)', async () => {
    const id1 = generateValidUuid();
    const id2 = generateValidUuid();
    const pre1 = generateValidHash();
    const post1 = generateValidHash();
    const pre2 = generateValidHash();
    const post2 = generateValidHash();

    const file1Data = [
      {
        repository: { url: 'https://github.com/u/r1', name: 'r1' },
        preFixHash: pre1, postFixHash: post1,
        curation: { score: 0.1, reasoning: 'V1', isApproved: false },
        status: 'pending',
        metadata: { candidateId: id1, createdAt: new Date().toISOString() },
      },
    ];

    const file2Data = [
      {
        repository: { url: 'https://github.com/u/r1', name: 'r1' },
        preFixHash: pre1, postFixHash: post1,
        curation: { score: 0.5, reasoning: 'V2', isApproved: false },
        status: 'validated',
        metadata: { candidateId: id1, createdAt: new Date().toISOString() },
      },
      {
        repository: { url: 'https://github.com/u/r2', name: 'r2' },
        preFixHash: pre2, postFixHash: post2,
        curation: { score: 0.1, reasoning: 'V1', isApproved: false },
        status: 'pending',
        metadata: { candidateId: id2, createdAt: new Date().toISOString() },
      },
    ];

    const file3Data = [
      {
        repository: { url: 'https://github.com/u/r1', name: 'r1' },
        preFixHash: pre1, postFixHash: post1,
        curation: { score: 0.9, reasoning: 'V3', isApproved: true },
        status: 'curated',
        metadata: { candidateId: id1, createdAt: new Date().toISOString() },
      },
      {
        repository: { url: 'https://github.com/u/r2', name: 'r2' },
        preFixHash: pre2, postFixHash: post2,
        curation: { score: 0.9, reasoning: 'V2', isApproved: true },
        status: 'curated',
        metadata: { candidateId: id2, createdAt: new Date().toISOString() },
      },
    ];

    const paths = [
      path.join(os.tmpdir(), `complex-1-${Date.now()}.jsonl`),
      path.join(os.tmpdir(), `complex-2-${Date.now()}.jsonl`),
      path.join(os.tmpdir(), `complex-3-${Date.now()}.jsonl`),
    ];

    await fs.writeFile(paths[0], file1Data.map(d => JSON.stringify(d)).join('\n'));
    await fs.writeFile(paths[1], file2Data.map(d => JSON.stringify(d)).join('\n'));
    await fs.writeFile(paths[2], file3Data.map(d => JSON.stringify(d)).join('\n'));

    await importer.import(paths[0]);
    await importer.import(paths[1]);
    await importer.import(paths[2]);

    const allCandidates = repo.getAll();
    expect(allCandidates).toHaveLength(2);
    
    const c1 = allCandidates.find(c => c.id === id1);
    expect(c1?.status).toBe('curated');
    expect(c1?.curation?.reasoning).toBe('V3');

    const c2 = allCandidates.find(c => c.id === id2);
    expect(c2?.status).toBe('curated');
    expect(c2?.curation?.reasoning).toBe('V2');

    for (const p of paths) await fs.unlink(p);
  });

  it('should throw an error when the JSONL file is malformed', async () => {
    await fs.writeFile(tempFile, 'this is not json\n{ "invalid": "json" }');

    await expect(importer.import(tempFile)).rejects.toThrow();
  });

  it('should throw an error when candidates do not match the expected schema', async () => {
    const invalidData = [
      {
        repository: { url: 'not-a-url', name: 'repo1' }, // Invalid URL
        preFixHash: 'pre-1',
        postFixHash: 'post-1',
        curation: { score: 1.5, reasoning: 'too high', isApproved: true }, // score > 1
        status: 'validated',
        metadata: { candidateId: 'uuid-1', createdAt: 'not-a-date' },
      },
    ];

    await fs.writeFile(tempFile, invalidData.map(d => JSON.stringify(d)).join('\n'));

    await expect(importer.import(tempFile)).rejects.toThrow();
  });


  it('should handle overlapping candidates across different files (upsert)', async () => {
    const id1 = generateValidUuid();
    const id2 = generateValidUuid();
    const id3 = generateValidUuid();
    const pre1 = generateValidHash();
    const post1 = generateValidHash();
    const pre2 = generateValidHash();
    const post2 = generateValidHash();
    const pre3 = generateValidHash();
    const post3 = generateValidHash();

    const file1Data = [
      {
        repository: { url: 'https://github.com/u/r1', name: 'r1' },
        preFixHash: pre1, postFixHash: post1,
        curation: { score: 0.5, reasoning: 'Initial 1', isApproved: false },
        status: 'validated',
        metadata: { candidateId: id1, createdAt: new Date().toISOString() },
      },
      {
        repository: { url: 'https://github.com/u/r2', name: 'r2' },
        preFixHash: pre2, postFixHash: post2,
        curation: { score: 0.5, reasoning: 'Initial 2', isApproved: false },
        status: 'validated',
        metadata: { candidateId: id2, createdAt: new Date().toISOString() },
      },
    ];

    const file2Data = [
      {
        repository: { url: 'https://github.com/u/r2', name: 'r2' },
        preFixHash: pre2, postFixHash: post2,
        curation: { score: 0.9, reasoning: 'Updated 2', isApproved: true },
        status: 'validated',
        metadata: { candidateId: id2, createdAt: new Date().toISOString() },
      },
      {
        repository: { url: 'https://github.com/u/r3', name: 'r3' },
        preFixHash: pre3, postFixHash: post3,
        curation: { score: 0.5, reasoning: 'Initial 3', isApproved: false },
        status: 'validated',
        metadata: { candidateId: id3, createdAt: new Date().toISOString() },
      },
    ];

    const file1Path = path.join(os.tmpdir(), `overlap-1-${Date.now()}.jsonl`);
    const file2Path = path.join(os.tmpdir(), `overlap-2-${Date.now()}.jsonl`);

    await fs.writeFile(file1Path, file1Data.map(d => JSON.stringify(d)).join('\n'));
    await fs.writeFile(file2Path, file2Data.map(d => JSON.stringify(d)).join('\n'));

    await importer.import(file1Path);
    await importer.import(file2Path);

    const allCandidates = repo.getAll();
    expect(allCandidates).toHaveLength(3);
    
    const candidate2 = allCandidates.find(c => c.id === id2);
    expect(candidate2?.curation?.score).toBe(0.9);
    expect(candidate2?.curation?.reasoning).toBe('Updated 2');

    await fs.unlink(file1Path);
    await fs.unlink(file2Path);
  });


});
