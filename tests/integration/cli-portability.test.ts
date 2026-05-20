import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { reinitDatabase } from '../../src/infrastructure/persistence/database';
import { generateValidUuid, generateValidHash } from '../helpers/dataset';

const CLI_CMD = 'npx tsx src/cli/index.ts';

describe('CLI Dataset Portability Integration', () => {
  let tempExportFile: string;
  let tempImportFile: string;
  let tempDbPath: string;

  beforeEach(async () => {
    tempDbPath = path.join(os.tmpdir(), `repobench-cli-test-${Date.now()}.db`);
    await reinitDatabase(tempDbPath);
    tempExportFile = path.join(os.tmpdir(), `cli-export-${Date.now()}.jsonl`);
    tempImportFile = path.join(os.tmpdir(), `cli-import-${Date.now()}.jsonl`);
  });

  afterEach(async () => {
    try {
      await fs.unlink(tempExportFile);
    } catch {}
    try {
      await fs.unlink(tempImportFile);
    } catch {}
    try {
      await fs.unlink(tempDbPath);
    } catch {}
  });

  const runCli = (args: string) => {
    return execSync(`${CLI_CMD} ${args}`, {
      env: { ...process.env, REPOBENCH_DB_PATH: tempDbPath }
    }).toString();
  };

  describe('export command', () => {
    it('should export the dataset to a file and display success message', async () => {
      const id = generateValidUuid();
      const hash = generateValidHash();
      const pre = generateValidHash();
      const post = generateValidHash();
      
      // Use a separate script or direct DB access to insert, but since we are in TS, 
      // we can use the repository or raw DB if we can get it. 
      // Actually, we can just use the raw DB via a helper since reinitDatabase was called.
      // For simplicity, let's use the raw DB via a small trick or just use the repo.
      
      // To avoid importing repo and dealing with its internal DB reference (which might be wrong),
      // let's use a simple SQL insert via a temp script or similar, or just trust the repo
      // if we ensure it uses the same DB path.
      
      // Better: Use a helper to insert.
      const { db } = await import('../../src/infrastructure/persistence/database');
      // Note: db might be cached. We should probably use a fresh import or ensure reinitDatabase updated it.
      // Since we call reinitDatabase(tempDbPath), the 'db' instance should be updated if it's a singleton.
      
      await db.prepare(`
        INSERT INTO candidates (id, hash, message, files, status, created_at, repository_url, repository_name, pre_fix_hash, post_fix_hash, curation_score, curation_reasoning, curation_is_approved)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, hash, 'test message', '[]', 'curated', new Date().toISOString(),
        'https://github.com/user/repo', 'repo', pre, post, 0.9, 'Good', 1
      );

      const output = runCli(`export ${tempExportFile}`);

      expect(output).toContain('Export successful');
      expect(output).toContain('1 candidate(s) processed');
      expect(await fs.access(tempExportFile).then(() => true).catch(() => false)).toBe(true);
      
      const content = await fs.readFile(tempExportFile, 'utf-8');
      expect(content).toContain(id);
    }, 20000);

    it('should export only curated and approved candidates and report the correct count', async () => {
      const idApp = generateValidUuid();
      const idRej = generateValidUuid();
      const idPen = generateValidUuid();
      const { db } = await import('../../src/infrastructure/persistence/database');
      
      await db.prepare(`
        INSERT INTO candidates (id, hash, message, files, status, created_at, repository_url, repository_name, pre_fix_hash, post_fix_hash, curation_score, curation_reasoning, curation_is_approved)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        idApp, generateValidHash(), 'm1', '[]', 'curated', new Date().toISOString(), 'https://github.com/u/r1', 'r1', generateValidHash(), generateValidHash(), 0.9, 'G1', 1,
        idRej, generateValidHash(), 'm2', '[]', 'curated', new Date().toISOString(), 'https://github.com/u/r2', 'r2', generateValidHash(), generateValidHash(), 0.1, 'R2', 0,
        idPen, generateValidHash(), 'm3', '[]', 'pending', new Date().toISOString(), 'https://github.com/u/r3', 'r3', generateValidHash(), generateValidHash(), null, null, null
      );

      const output = runCli(`export ${tempExportFile}`);

      expect(output).toContain('Export successful');
      expect(output).toContain('1 candidate(s) processed');
      
      const content = await fs.readFile(tempExportFile, 'utf-8');
      expect(content).toContain(idApp);
      expect(content).not.toContain(idRej);
      expect(content).not.toContain(idPen);
    });

    it('should display an error message when the export path is invalid', async () => {
      const invalidPath = '/invalid/path/export.jsonl';
      
      expect(() => {
        runCli(`export ${invalidPath}`);
      }).toThrow(/Error/i);
    });
  });

  describe('import command', () => {
    it('should import a dataset from a file and display success message', async () => {
      const id = generateValidUuid();
      const mockData = [
        {
          repository: { url: 'https://github.com/user/repo1', name: 'repo1' },
          preFixHash: generateValidHash(),
          postFixHash: generateValidHash(),
          curation: { score: 0.9, reasoning: 'Good', isApproved: true },
          status: 'validated',
          metadata: { candidateId: id, createdAt: new Date().toISOString() },
        }
      ];
      await fs.writeFile(tempImportFile, mockData.map(d => JSON.stringify(d)).join('\n'));

      const output = runCli(`import ${tempImportFile}`);

      expect(output).toContain('Import successful');
      expect(output).toContain('1 candidate(s) processed');
      
      const { db } = await import('../../src/infrastructure/persistence/database');
      const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(id);
      expect(candidate).toBeDefined();
      expect(candidate.repositoryUrl).toBe('https://github.com/user/repo1');
    }, 30000);

    it('should import multiple candidates and display correct count', async () => {
      const mockData = [
        {
          repository: { url: 'https://github.com/user/repo1', name: 'repo1' },
          preFixHash: generateValidHash(),
          postFixHash: generateValidHash(),
          curation: { score: 0.9, reasoning: 'Good', isApproved: true },
          status: 'validated',
          metadata: { candidateId: generateValidUuid(), createdAt: new Date().toISOString() },
        },
        {
          repository: { url: 'https://github.com/user/repo2', name: 'repo2' },
          preFixHash: generateValidHash(),
          postFixHash: generateValidHash(),
          curation: { score: 0.9, reasoning: 'Good', isApproved: true },
          status: 'validated',
          metadata: { candidateId: generateValidUuid(), createdAt: new Date().toISOString() },
        }
      ];
      await fs.writeFile(tempImportFile, mockData.map(d => JSON.stringify(d)).join('\n'));

      const output = runCli(`import ${tempImportFile}`);

      expect(output).toContain('Import successful');
      expect(output).toContain('2 candidate(s) processed');
    }, 30000);

    it('should display an error message when the import file is malformed', async () => {
      await fs.writeFile(tempImportFile, 'invalid jsonl content');

      expect(() => {
        runCli(`import ${tempImportFile}`);
      }).toThrow(/Error/i);
    }, 30000);

    it('should display an error message when the import file is missing', async () => {
      const missingFile = path.join(os.tmpdir(), 'non-existent.jsonl');
      
      expect(() => {
        runCli(`import ${missingFile}`);
      }).toThrow(/Error/i);
    }, 30000);
  });
});
