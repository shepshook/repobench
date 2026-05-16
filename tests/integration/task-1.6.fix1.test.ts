import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JsonlDatasetExporter } from '../../src/infrastructure/jsonl-dataset-exporter';
import { JsonlDatasetImporter } from '../../src/infrastructure/jsonl-dataset-importer';
import { CandidateRepository } from '../../src/core/repositories/candidate-repository';
import { db, reinitDatabase } from '../../src/infrastructure/persistence/database';
import { generateValidUuid, generateValidHash } from '../helpers/dataset';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

const CLI_CMD = 'npx tsx src/cli/index.ts';

describe('Task 1.6.FIX1: Dataset Portability', () => {
  let repo: CandidateRepository;
  let exporter: JsonlDatasetExporter;
  let importer: JsonlDatasetImporter;
  let tempFile: string;
  let tempDbPath: string;

  beforeEach(async () => {
    tempDbPath = path.join(os.tmpdir(), `task-1.6-fix1-db-${Date.now()}-${Math.random()}.db`);
    await reinitDatabase(tempDbPath);
    repo = new CandidateRepository();
    exporter = new JsonlDatasetExporter(repo);
    importer = new JsonlDatasetImporter(repo);
    tempFile = path.join(os.tmpdir(), `task-1.6-fix1-${Date.now()}.jsonl`);
  });

  afterEach(async () => {
    try {
      await fs.unlink(tempFile);
    } catch {}
    try {
      await fs.unlink(tempDbPath);
    } catch {}
  });

  describe('CandidateRepository Curation Data', () => {
    it('should correctly retrieve curation data (no case mismatch)', async () => {
      const candidateId = generateValidUuid();
      const candidate = {
        id: candidateId,
        hash: generateValidHash(), message: 'm1', files: [], status: 'curated' as const,
        created_at: new Date(), curation: { score: 0.85, reasoning: 'Reason', isApproved: true },
        repositoryUrl: 'https://github.com/user/repo', repositoryName: 'repo', preFixHash: generateValidHash(), postFixHash: generateValidHash(),
      };
      repo.save(candidate);

      const retrieved = repo.getAll().find(c => c.id === candidateId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.curation).toBeDefined();
      expect(retrieved?.curation?.score).toBe(0.85);
      expect(retrieved?.curation?.isApproved).toBe(true);
    });
  });

  describe('Exporter Filtering', () => {
    it('should strictly export only candidates with status="curated" AND isApproved=true', async () => {
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
        {
          id: generateValidUuid(),
          hash: generateValidHash(), message: 'm4', files: [], status: 'pending' as const,
          created_at: new Date(), curation: { score: 0.9, reasoning: 'R4', isApproved: true },
          repositoryUrl: 'https://github.com/user/repo4', repositoryName: 'n4', preFixHash: generateValidHash(), postFixHash: generateValidHash(),
        },
      ];

      for (const c of candidates) repo.save(c);

      await exporter.export(tempFile);

      const content = await fs.readFile(tempFile, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      
      expect(lines).toHaveLength(1);
      expect(JSON.parse(lines[0]).metadata.candidateId).toBe(idApp);
    });
  });

  describe('Importer Idempotency (Upsert)', () => {
    it('should update an existing candidate instead of skipping it (upsert behavior)', async () => {
      const candidateId = generateValidUuid();
      const initialCandidate = {
        id: candidateId,
        hash: generateValidHash(), message: 'm1', files: [], status: 'validated' as const,
        created_at: new Date(), curation: { score: 0.5, reasoning: 'Initial', isApproved: false },
        repositoryUrl: 'https://github.com/user/repo-upsert', repositoryName: 'n1', preFixHash: generateValidHash(), postFixHash: generateValidHash(),
      };
      repo.save(initialCandidate);

      const updatedData = {
        repository: { url: 'https://github.com/user/repo-upsert', name: 'n1' },
        preFixHash: initialCandidate.preFixHash, postFixHash: initialCandidate.postFixHash,
        curation: { score: 0.9, reasoning: 'Updated', isApproved: true },
        status: 'validated',
        metadata: { candidateId: candidateId, createdAt: new Date().toISOString() },
      };
      
      await fs.writeFile(tempFile, JSON.stringify(updatedData));
      const importedCount = await importer.import(tempFile);
      expect(importedCount).toBe(1);

      const candidate = repo.getAll().find(c => c.id === candidateId);
      expect(candidate).toBeDefined();
      expect(candidate?.curation?.score).toBe(0.9);
      expect(candidate?.curation?.reasoning).toBe('Updated');
      expect(candidate?.curation?.isApproved).toBe(true);
    });

    it('should not skip candidates with the same postFixHash but different candidateIds', async () => {
      const postHash = generateValidHash();
      const mockData = [
        {
          repository: { url: 'https://github.com/user/repo1', name: 'repo1' },
          preFixHash: generateValidHash(), postFixHash: postHash,
          curation: { score: 0.9, reasoning: 'R1', isApproved: true },
          status: 'validated',
          metadata: { candidateId: generateValidUuid(), createdAt: new Date().toISOString() },
        },
        {
          repository: { url: 'https://github.com/user/repo2', name: 'repo2' },
          preFixHash: generateValidHash(), postFixHash: postHash,
          curation: { score: 0.8, reasoning: 'R2', isApproved: true },
          status: 'validated',
          metadata: { candidateId: generateValidUuid(), createdAt: new Date().toISOString() },
        },
      ];
      
      await fs.writeFile(tempFile, mockData.map(d => JSON.stringify(d)).join('\n'));
      await importer.import(tempFile);

      const all = repo.getAll();
      expect(all).toHaveLength(2);
    });
  });

  describe('CLI Integration', () => {
    let tempDbPath: string;

    beforeEach(async () => {
      tempDbPath = path.join(os.tmpdir(), `task-1.6-cli-db-${Date.now()}.db`);
      await reinitDatabase(tempDbPath);
    });

    afterEach(async () => {
      try {
        await fs.unlink(tempDbPath);
      } catch {}
    });

    it('should only export curated and approved candidates via CLI', async () => {
      const idApp = generateValidUuid();
      const candidates = [
        {
          id: idApp,
          hash: generateValidHash(), message: 'm1', files: [], status: 'curated' as const,
          created_at: new Date(), curation: { score: 0.9, reasoning: 'R1', isApproved: true },
          repositoryUrl: 'https://github.com/user/repo-cli1', repositoryName: 'n1', preFixHash: generateValidHash(), postFixHash: generateValidHash(),
        },
        {
          id: generateValidUuid(),
          hash: generateValidHash(), message: 'm3', files: [], status: 'validated' as const,
          created_at: new Date(), curation: { score: 0.9, reasoning: 'R3', isApproved: true },
          repositoryUrl: 'https://github.com/user/repo-cli2', repositoryName: 'n3', preFixHash: generateValidHash(), postFixHash: generateValidHash(),
        },
      ];

      // We need to use the DB at tempDbPath to insert
      const { db } = await import('../../src/infrastructure/persistence/database');
      for (const c of candidates) {
        await db.prepare(`
          INSERT INTO candidates (id, hash, message, files, status, created_at, repository_url, repository_name, pre_fix_hash, post_fix_hash, curation_score, curation_reasoning, curation_is_approved)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          c.id, c.hash, c.message, JSON.stringify(c.files), c.status, c.created_at.toISOString(),
          c.repositoryUrl, c.repositoryName, c.preFixHash, c.postFixHash, 
          c.curation?.score, c.curation?.reasoning, c.curation ? (c.curation.isApproved ? 1 : 0) : null
        );
      }

      execSync(`${CLI_CMD} export ${tempFile}`, {
        env: { ...process.env, REPOBENCH_DB_PATH: tempDbPath }
      });

      const content = await fs.readFile(tempFile, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      
      expect(lines).toHaveLength(1);
      expect(JSON.parse(lines[0]).metadata.candidateId).toBe(idApp);
    });
  });
});
