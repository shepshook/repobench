import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JsonlDatasetImporter } from '../../src/infrastructure/jsonl-dataset-importer';
import { JsonlDatasetExporter } from '../../src/infrastructure/jsonl-dataset-exporter';
import { CandidateRepository } from '../../src/core/repositories/candidate-repository';
import { reinitDatabase, db } from '../../src/infrastructure/persistence/database';
import { generateValidUuid, generateValidHash } from '../helpers/dataset';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

const CLI_CMD = 'npx tsx src/cli/index.ts';

describe('Task 1.6.FIX2: Regression Tests', () => {
  let repo: CandidateRepository;
  let importer: JsonlDatasetImporter;
  let exporter: JsonlDatasetExporter;
  let tempFile: string;
  let testDb: string;

  beforeEach(async () => {
    testDb = path.join(os.tmpdir(), `repobench-test-${Date.now()}-${Math.random()}.db`);
    reinitDatabase(testDb);
    repo = new CandidateRepository();
    importer = new JsonlDatasetImporter(repo);
    exporter = new JsonlDatasetExporter(repo);
    tempFile = path.join(os.tmpdir(), `task-1.6-fix2-${Date.now()}-${Math.random()}.jsonl`);
  });

  afterEach(async () => {
    try {
      await fs.unlink(tempFile);
    } catch {}
    try {
      await fs.unlink(testDb);
    } catch {}
  });

  it('should not create duplicate records when importing the same file multiple times (Upsert check)', async () => {
    const id = generateValidUuid();
    const mockData = [
      {
        repository: { url: 'https://github.com/user/repo1', name: 'repo1' },
        preFixHash: generateValidHash(),
        postFixHash: generateValidHash(),
        curation: { score: 0.9, reasoning: 'Good', isApproved: true },
        status: 'validated',
        metadata: { candidateId: id, createdAt: new Date().toISOString() },
      },
    ];

    await fs.writeFile(tempFile, mockData.map(d => JSON.stringify(d)).join('\n'));

    // Import 4 times to replicate the "got 4" observation
    for (let i = 0; i < 4; i++) {
      await importer.import(tempFile);
    }

    const allCandidates = repo.getAll();
    expect(allCandidates).toHaveLength(1);
    expect(allCandidates[0].id).toBe(id);
  });

  it('should export only curated and approved candidates (Filtering check)', async () => {
    const idApp = generateValidUuid();
    const candidates = [
      {
        id: idApp,
        hash: generateValidHash(), message: 'm1', files: [], status: 'curated' as const,
        created_at: new Date(), curation: { score: 0.9, reasoning: 'R1', isApproved: true },
        repositoryUrl: 'https://github.com/user/repo1', repositoryName: 'n1', preFixHash: generateValidHash(), postFixHash: generateValidHash(),
      },
      {
        id: generateValidUuid(),
        hash: generateValidHash(), message: 'm2', files: [], status: 'curated' as const,
        created_at: new Date(), curation: { score: 0.1, reasoning: 'R2', isApproved: false },
        repositoryUrl: 'https://github.com/user/repo2', repositoryName: 'n2', preFixHash: generateValidHash(), postFixHash: generateValidHash(),
      },
      {
        id: generateValidUuid(),
        hash: generateValidHash(), message: 'm3', files: [], status: 'validated' as const,
        created_at: new Date(), curation: { score: 0.9, reasoning: 'R3', isApproved: true },
        repositoryUrl: 'https://github.com/user/repo3', repositoryName: 'n3', preFixHash: generateValidHash(), postFixHash: generateValidHash(),
      },
    ];

    for (const c of candidates) repo.save(c);

    await exporter.export(tempFile);

    const content = await fs.readFile(tempFile, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).metadata.candidateId).toBe(idApp);
  });

  it('should report the correct candidate count in CLI export output (CLI Count check)', async () => {
    // Setup: Add 1 curated and approved candidate
    await db.prepare(`
      INSERT INTO candidates (id, hash, message, files, status, created_at, repository_url, repository_name, pre_fix_hash, post_fix_hash, curation_score, curation_reasoning, curation_is_approved)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      generateValidUuid(), generateValidHash(), 'm', '[]', 'curated', new Date().toISOString(),
      'https://github.com/user/repo', 'repo', generateValidHash(), generateValidHash(), 0.9, 'Good', 1
    );

    const output = execSync(`${CLI_CMD} export ${tempFile}`, {
      env: { ...process.env, REPOBENCH_DB_PATH: testDb }
    }).toString();

    expect(output).toContain('Export successful');
    expect(output).toContain('1 candidate(s) processed');
  });
});
