import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { reinitDatabase } from '../../src/infrastructure/persistence/database';
import { JsonlDatasetExporter } from '../../src/infrastructure/jsonl-dataset-exporter';
import { JsonlDatasetImporter } from '../../src/infrastructure/jsonl-dataset-importer';
import { CandidateRepository } from '../../src/core/repositories/candidate-repository';
import { generateValidUuid, generateValidHash } from '../helpers/dataset';

const CLI_CMD = 'npx tsx src/cli/index.ts';

describe('Task 1.6.FIX3: Dataset Portability Regressions', () => {
  let repo: CandidateRepository;
  let exporter: JsonlDatasetExporter;
  let importer: JsonlDatasetImporter;
  let tempFile: string;
  let testDb: string;

  beforeEach(async () => {
    testDb = path.join(os.tmpdir(), `repobench-test-${Date.now()}-${Math.random()}.db`);
    reinitDatabase(testDb);
    repo = new CandidateRepository();
    // @ts-ignore
    exporter = new JsonlDatasetExporter(repo);
    // @ts-ignore
    importer = new JsonlDatasetImporter(repo);
    tempFile = path.join(os.tmpdir(), `fix3-test-${Date.now()}.jsonl`);
  });

  afterEach(async () => {
    try {
      await fs.unlink(tempFile);
    } catch {}
    try {
      await fs.unlink(testDb);
    } catch {}
  });

  describe('Export Filtering Logic', () => {
    it('should only export candidates with status "curated"', async () => {
      const idCur = generateValidUuid();
      const candidates = [
        {
          id: idCur,
          hash: generateValidHash(),
          message: 'm1',
          files: [],
          status: 'curated' as const,
          created_at: new Date(),
          curation: { score: 0.9, reasoning: 'OK', isApproved: true },
          repositoryUrl: 'https://github.com/u/r1',
          repositoryName: 'r1',
          preFixHash: generateValidHash(),
          postFixHash: generateValidHash(),
        },
        {
          id: generateValidUuid(),
          hash: generateValidHash(),
          message: 'm2',
          files: [],
          status: 'pending' as const,
          created_at: new Date(),
          repositoryUrl: 'https://github.com/u/r2',
          repositoryName: 'r2',
          preFixHash: generateValidHash(),
          postFixHash: generateValidHash(),
        },
        {
          id: generateValidUuid(),
          hash: generateValidHash(),
          message: 'm3',
          files: [],
          status: 'validated' as const,
          created_at: new Date(),
          curation: { score: 0.8, reasoning: 'OK', isApproved: true },
          repositoryUrl: 'https://github.com/u/r3',
          repositoryName: 'r3',
          preFixHash: generateValidHash(),
          postFixHash: generateValidHash(),
        },
      ];

      for (const c of candidates) {
        repo.save(c);
      }

      await exporter.export(tempFile);

      const content = await fs.readFile(tempFile, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      expect(lines).toHaveLength(1);
      expect(JSON.parse(lines[0]).metadata.candidateId).toBe(idCur);
    });

    it('should write actual newline characters instead of literal "\\n" strings', async () => {
      const candidates = [
        {
          id: generateValidUuid(),
          hash: generateValidHash(),
          message: 'm1',
          files: [],
          status: 'curated' as const,
          created_at: new Date(),
          curation: { score: 0.9, reasoning: 'OK', isApproved: true },
          repositoryUrl: 'https://github.com/u/r1',
          repositoryName: 'r1',
          preFixHash: generateValidHash(),
          postFixHash: generateValidHash(),
        },
        {
          id: generateValidUuid(),
          hash: generateValidHash(),
          message: 'm2',
          files: [],
          status: 'curated' as const,
          created_at: new Date(),
          curation: { score: 0.8, reasoning: 'OK', isApproved: true },
          repositoryUrl: 'https://github.com/u/r2',
          repositoryName: 'r2',
          preFixHash: generateValidHash(),
          postFixHash: generateValidHash(),
        },
      ];
      for (const c of candidates) repo.save(c);

      await exporter.export(tempFile);

      const content = await fs.readFile(tempFile, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      expect(lines).toHaveLength(2);
    });

    it('should not return an empty set when curated candidates exist', async () => {
      repo.save({
        id: generateValidUuid(),
        hash: generateValidHash(),
        message: 'm',
        files: [],
        status: 'curated' as const,
        created_at: new Date(),
        curation: { score: 0.9, reasoning: 'OK', isApproved: true },
        repositoryUrl: 'https://github.com/u/r',
        repositoryName: 'r',
        preFixHash: generateValidHash(),
        postFixHash: generateValidHash(),
      });

      await exporter.export(tempFile);

      const content = await fs.readFile(tempFile, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      expect(lines).toHaveLength(1);
    });
  });

  describe('Import Upsert Logic', () => {
    it('should perform an upsert and not create duplicate records for the same candidate ID', async () => {
      const id = generateValidUuid();
      const pre = generateValidHash();
      const post = generateValidHash();
      const mockData1 = [
        {
          repository: { url: 'https://github.com/user/repo1', name: 'repo1' },
          preFixHash: pre,
          postFixHash: post,
          curation: { score: 0.9, reasoning: 'Initial', isApproved: true },
          status: 'validated',
          metadata: { candidateId: id, createdAt: new Date().toISOString() },
        },
      ];

      const mockData2 = [
        {
          repository: { url: 'https://github.com/user/repo1', name: 'repo1' },
          preFixHash: pre,
          postFixHash: post,
          curation: { score: 0.95, reasoning: 'Updated', isApproved: true },
          status: 'validated',
          metadata: { candidateId: id, createdAt: new Date().toISOString() },
        },
      ];

      await fs.writeFile(tempFile, mockData1.map(d => JSON.stringify(d)).join('\n'));
      await importer.import(tempFile);

      await fs.writeFile(tempFile, mockData2.map(d => JSON.stringify(d)).join('\n'));
      await importer.import(tempFile);

      const matches = repo.getAll().filter(c => c.id === id);
      expect(matches).toHaveLength(1);
      expect(matches[0].curation?.reasoning).toBe('Updated');
    });
  });

  describe('CLI Export Reporting', () => {
    it('should accurately report the number of processed candidates in CLI output', async () => {
      const candidates = [
        {
          id: generateValidUuid(),
          hash: generateValidHash(),
          message: 'm1',
          files: [],
          status: 'curated' as const,
          created_at: new Date(),
          curation: { score: 0.9, reasoning: 'OK', isApproved: true },
          repositoryUrl: 'https://github.com/u/r1',
          repositoryName: 'r1',
          preFixHash: generateValidHash(),
          postFixHash: generateValidHash(),
        },
        {
          id: generateValidUuid(),
          hash: generateValidHash(),
          message: 'm2',
          files: [],
          status: 'curated' as const,
          created_at: new Date(),
          curation: { score: 0.8, reasoning: 'OK', isApproved: true },
          repositoryUrl: 'https://github.com/u/r2',
          repositoryName: 'r2',
          preFixHash: generateValidHash(),
          postFixHash: generateValidHash(),
        },
        {
          id: generateValidUuid(),
          hash: generateValidHash(),
          message: 'm3',
          files: [],
          status: 'pending' as const,
          created_at: new Date(),
          repositoryUrl: 'https://github.com/u/r3',
          repositoryName: 'r3',
          preFixHash: generateValidHash(),
          postFixHash: generateValidHash(),
        },
      ];

      for (const c of candidates) {
        repo.save(c);
      }

      const output = execSync(`${CLI_CMD} export ${tempFile}`, {
        env: { ...process.env, REPOBENCH_DB_PATH: testDb }
      }).toString();
      expect(output).toContain('2 candidate(s) processed');
    });

    it('should report 0 candidates processed when no curated candidates exist', async () => {
      repo.save({
        id: generateValidUuid(),
        hash: generateValidHash(),
        message: 'm',
        files: [],
        status: 'pending' as const,
        created_at: new Date(),
        repositoryUrl: 'https://github.com/u/r',
        repositoryName: 'r',
        preFixHash: generateValidHash(),
        postFixHash: generateValidHash(),
      });

      const output = execSync(`${CLI_CMD} export ${tempFile}`, {
        env: { ...process.env, REPOBENCH_DB_PATH: testDb }
      }).toString();
      expect(output).toContain('0 candidate(s) processed');
    });
  });
});
