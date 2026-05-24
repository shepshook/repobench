import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { GitMiner } from '../../src/core/services/miner.js';
import type { RepoBenchConfig } from '../../src/core/config.js';

describe('GitMiner Since Date Filtering (Task 1.8.1)', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repobench-since-'));
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function initRepo(dir: string) {
    execSync('git init', { cwd: dir });
    execSync('git config user.email "test@example.com"', { cwd: dir });
    execSync('git config user.name "Test User"', { cwd: dir });
  }

  it('should return only commits after the since date when since is provided', async () => {
    const testDir = path.join(tempDir, 'since-filter');
    await fs.mkdir(testDir, { recursive: true });
    initRepo(testDir);

    await fs.writeFile(path.join(testDir, 'old.ts'), '// old');
    execSync('git add .', { cwd: testDir });
    execSync('git commit -m "feat: old feature"', {
      cwd: testDir,
      env: { ...process.env, GIT_AUTHOR_DATE: '2020-06-15T12:00:00Z', GIT_COMMITTER_DATE: '2020-06-15T12:00:00Z' },
    });

    await fs.writeFile(path.join(testDir, 'new.ts'), '// new');
    execSync('git add .', { cwd: testDir });
    execSync('git commit -m "feat: new feature"', {
      cwd: testDir,
      env: { ...process.env, GIT_AUTHOR_DATE: '2024-06-15T12:00:00Z', GIT_COMMITTER_DATE: '2024-06-15T12:00:00Z' },
    });

    const originalCwd = process.cwd();
    process.chdir(testDir);
    try {
      const repository = {
        save: () => {},
        upsert: () => {},
        exists: () => false,
        existsById: () => false,
        getById: () => undefined,
        getAll: () => [],
      };
      const miner = new GitMiner(repository as any);
      const config: RepoBenchConfig = {
        mining: { keywords: [], exclude_paths: [], since: '2024-01-01T00:00:00.000Z' },
      };

      const results = await miner.mineCommits(config);

      expect(results.length).toBe(1);
      expect(results[0].message).toBe('feat: new feature');
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should return only commits after the since date when since is date-only format YYYY-MM-DD', async () => {
    const testDir = path.join(tempDir, 'since-filter-dateonly');
    await fs.mkdir(testDir, { recursive: true });
    initRepo(testDir);

    await fs.writeFile(path.join(testDir, 'old.ts'), '// old');
    execSync('git add .', { cwd: testDir });
    execSync('git commit -m "feat: old feature"', {
      cwd: testDir,
      env: { ...process.env, GIT_AUTHOR_DATE: '2020-06-15T12:00:00Z', GIT_COMMITTER_DATE: '2020-06-15T12:00:00Z' },
    });

    await fs.writeFile(path.join(testDir, 'new.ts'), '// new');
    execSync('git add .', { cwd: testDir });
    execSync('git commit -m "feat: new feature"', {
      cwd: testDir,
      env: { ...process.env, GIT_AUTHOR_DATE: '2024-06-15T12:00:00Z', GIT_COMMITTER_DATE: '2024-06-15T12:00:00Z' },
    });

    const originalCwd = process.cwd();
    process.chdir(testDir);
    try {
      const repository = {
        save: () => {},
        upsert: () => {},
        exists: () => false,
        existsById: () => false,
        getById: () => undefined,
        getAll: () => [],
      };
      const miner = new GitMiner(repository as any);
      const config: RepoBenchConfig = {
        mining: { keywords: [], exclude_paths: [], since: '2024-01-01' },
      };

      const results = await miner.mineCommits(config);

      expect(results.length).toBe(1);
      expect(results[0].message).toBe('feat: new feature');
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should return all commits when since is not provided', async () => {
    const testDir = path.join(tempDir, 'no-since');
    await fs.mkdir(testDir, { recursive: true });
    initRepo(testDir);

    await fs.writeFile(path.join(testDir, 'a.ts'), '// a');
    execSync('git add .', { cwd: testDir });
    execSync('git commit -m "feat: commit a"', { cwd: testDir });

    await fs.writeFile(path.join(testDir, 'b.ts'), '// b');
    execSync('git add .', { cwd: testDir });
    execSync('git commit -m "feat: commit b"', { cwd: testDir });

    const originalCwd = process.cwd();
    process.chdir(testDir);
    try {
      const repository = {
        save: () => {},
        upsert: () => {},
        exists: () => false,
        existsById: () => false,
        getById: () => undefined,
        getAll: () => [],
      };
      const miner = new GitMiner(repository as any);
      const config: RepoBenchConfig = {
        mining: { keywords: [], exclude_paths: [] },
      };

      const results = await miner.mineCommits(config);

      expect(results.length).toBe(2);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should use execFile output format (author_name/email/body empty) when since is not provided', async () => {
    const testDir = path.join(tempDir, 'no-since-format');
    await fs.mkdir(testDir, { recursive: true });
    initRepo(testDir);

    await fs.writeFile(path.join(testDir, 'a.ts'), '// a');
    execSync('git add .', { cwd: testDir });
    execSync('git commit -m "feat: commit a"', { cwd: testDir });

    await fs.writeFile(path.join(testDir, 'b.ts'), '// b');
    execSync('git add .', { cwd: testDir });
    execSync('git commit -m "feat: commit b"', { cwd: testDir });

    const originalCwd = process.cwd();
    process.chdir(testDir);
    try {
      const repository = {
        save: () => {},
        upsert: () => {},
        exists: () => false,
        existsById: () => false,
        getById: () => undefined,
        getAll: () => [],
      };
      const miner = new GitMiner(repository as any);
      const config: RepoBenchConfig = {
        mining: { keywords: [], exclude_paths: [] },
      };

      const results = await miner.mineCommits(config);

      // The execFile parser sets these to empty strings.
      // Current simple-git.log() path populates them — this assertion FAILS.
      for (const result of results) {
        expect(result.author_name).toBe('');
        expect(result.author_email).toBe('');
        expect(result.body).toBe('');
      }
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should apply keyword filtering together with since date filter', async () => {
    const testDir = path.join(tempDir, 'since-keyword');
    await fs.mkdir(testDir, { recursive: true });
    initRepo(testDir);

    await fs.writeFile(path.join(testDir, 'old.ts'), '// old');
    execSync('git add .', { cwd: testDir });
    execSync('git commit -m "feat: old feature"', {
      cwd: testDir,
      env: { ...process.env, GIT_AUTHOR_DATE: '2020-06-15T12:00:00Z', GIT_COMMITTER_DATE: '2020-06-15T12:00:00Z' },
    });

    await fs.writeFile(path.join(testDir, 'new.ts'), '// new');
    execSync('git add .', { cwd: testDir });
    execSync('git commit -m "feat: new feature"', {
      cwd: testDir,
      env: { ...process.env, GIT_AUTHOR_DATE: '2024-06-15T12:00:00Z', GIT_COMMITTER_DATE: '2024-06-15T12:00:00Z' },
    });

    await fs.writeFile(path.join(testDir, 'docs.ts'), '// docs');
    execSync('git add .', { cwd: testDir });
    execSync('git commit -m "docs: update documentation"', {
      cwd: testDir,
      env: { ...process.env, GIT_AUTHOR_DATE: '2024-06-16T12:00:00Z', GIT_COMMITTER_DATE: '2024-06-16T12:00:00Z' },
    });

    const originalCwd = process.cwd();
    process.chdir(testDir);
    try {
      const repository = {
        save: () => {},
        upsert: () => {},
        exists: () => false,
        existsById: () => false,
        getById: () => undefined,
        getAll: () => [],
      };
      const miner = new GitMiner(repository as any);
      const config: RepoBenchConfig = {
        mining: { keywords: ['feat'], exclude_paths: [], since: '2024-01-01T00:00:00.000Z' },
      };

      const results = await miner.mineCommits(config);

      expect(results.length).toBe(1);
      expect(results[0].message).toBe('feat: new feature');
    } finally {
      process.chdir(originalCwd);
    }
  });
});
