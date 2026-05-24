import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { GitMiner } from '../../src/core/services/miner.js';
import type { RepoBenchConfig } from '../../src/core/config.js';
import type { Candidate } from '../../src/core/contracts.js';

describe('Mine CLI Integration Test', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repobench-cli-test-'));
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // Helpers for dated-commit repos
  async function initRepo(dir: string) {
    execSync('git init', { cwd: dir });
    execSync('git config user.email "test@example.com"', { cwd: dir });
    execSync('git config user.name "Test User"', { cwd: dir });
  }

  async function createCommit(dir: string, file: string, content: string, message: string, date: string) {
    await fs.writeFile(path.join(dir, file), content);
    execSync('git add .', { cwd: dir });
    execSync(`git commit -m "${message}"`, {
      cwd: dir,
      env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
    });
  }

  async function setupRepo(dir: string) {
    // Initialize git repo
    execSync('git init', { cwd: dir });
    execSync('git config user.email "test@example.com"', { cwd: dir });
    execSync('git config user.name "Test User"', { cwd: dir });

    // Commit 1: Should match 'feat'
    await fs.writeFile(path.join(dir, 'file1.ts'), 'console.log("1");');
    execSync('git add .', { cwd: dir });
    execSync('git commit -m "feat: add feature 1"', { cwd: dir });

    // Commit 2: Should match 'fix'
    await fs.writeFile(path.join(dir, 'file2.ts'), 'console.log("2");');
    execSync('git add .', { cwd: dir });
    execSync('git commit -m "fix: fix bug 2"', { cwd: dir });

    // Commit 3: Should not match
    await fs.writeFile(path.join(dir, 'file3.ts'), 'console.log("3");');
    execSync('git add .', { cwd: dir });
    execSync('git commit -m "docs: update readme"', { cwd: dir });

    // Commit 4: Matches 'feat' but all files are in excluded paths
    await fs.mkdir(path.join(dir, 'node_modules'), { recursive: true });
    await fs.writeFile(path.join(dir, 'node_modules/dep.js'), 'console.log("dep");');
    execSync('git add .', { cwd: dir });
    execSync('git commit -m "feat: add dependency"', { cwd: dir });

    // Create repobench.yaml
    const configYaml = `
mining:
  keywords: ["feat", "fix"]
  exclude_paths: ["node_modules/"]
`;
    await fs.writeFile(path.join(dir, 'repobench.yaml'), configYaml);
  }

  it('should mine commits and output the correct count to stdout', async () => {
    await setupRepo(tempDir);

    const projectRoot = process.cwd();
    const scriptPath = path.join(projectRoot, 'src/cli/mine.ts');
    const configPath = path.join(tempDir, 'repobench.yaml');
    
    const stdout = execSync(`npx tsx ${scriptPath} -r ${tempDir} -c ${configPath}`, {
      cwd: projectRoot, 
      env: { ...process.env, PATH: process.env.PATH },
      timeout: 30000 // Increase timeout to 30s
    }).toString();

    expect(stdout).toContain('Found 2 candidates.');
  }, 30000);

  it('should filter out insignificant commits using GitMiner.mineCommits', async () => {
    const sigTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repobench-sig-test-'));
    try {
      // Initialize git repo
      execSync('git init', { cwd: sigTempDir });
      execSync('git config user.email "test@example.com"', { cwd: sigTempDir });
      execSync('git config user.name "Test User"', { cwd: sigTempDir });

      // 1. Meaningful fix (captured)
      await fs.writeFile(path.join(sigTempDir, 'app.ts'), 'function add(a, b) { return a + b; }');
      execSync('git add .', { cwd: sigTempDir });
      execSync('git commit -m "fix: resolve addition bug"', { cwd: sigTempDir });

      // 2. Pure whitespace (filtered)
      await fs.writeFile(path.join(sigTempDir, 'app.ts'), 'function add(a, b) { \n  return a + b; \n}');
      execSync('git add .', { cwd: sigTempDir });
      execSync('git commit -m "fix: whitespace cleanup"', { cwd: sigTempDir });

      // 3. Only comments (filtered)
      await fs.writeFile(path.join(sigTempDir, 'app.ts'), 'function add(a, b) { // adds two numbers\n  return a + b; \n}');
      execSync('git add .', { cwd: sigTempDir });
      execSync('git commit -m "fix: add documentation comments"', { cwd: sigTempDir });

      // 4. Only .md files (filtered)
      await fs.writeFile(path.join(sigTempDir, 'README.md'), '# Project');
      execSync('git add .', { cwd: sigTempDir });
      execSync('git commit -m "fix: update readme"', { cwd: sigTempDir });

      const originalCwd = process.cwd();
      process.chdir(sigTempDir);

      try {
        const repository = {
          save: () => {},
          upsert: () => {},
          exists: () => false,
          getAll: () => []
        };
        const miner = new GitMiner(repository);
        const config: RepoBenchConfig = {
          mining: {
            keywords: ['fix'],
            exclude_paths: [],
          },
        };

        const results = await miner.mineCommits(config);

        // Should only contain the "meaningful fix" commit
        expect(results.length).toBe(1);
        expect(results[0].message).toBe('fix: resolve addition bug');

        // Verify preFixHash/postFixHash are populated
        const candidate: Candidate = results[0];
        expect(candidate.postFixHash).toBeDefined();
        expect(typeof candidate.postFixHash).toBe('string');
        // postFixHash should match the mined commit hash
        expect(candidate.postFixHash).toBe(candidate.hash);
        // For the first (root) commit, preFixHash should be undefined
        // since git rev-parse <hash>^ fails
        expect(candidate.preFixHash).toBeUndefined();
      } finally {
        process.chdir(originalCwd);
      }
    } finally {
      await fs.rm(sigTempDir, { recursive: true, force: true });
    }
  });

  it('should filter commits by --since date when passed via CLI', async () => {
    const sinceDir = path.join(tempDir, 'cli-since');
    await fs.mkdir(sinceDir, { recursive: true });
    initRepo(sinceDir);

    await createCommit(sinceDir, 'old.ts', '// old', 'feat: old feature', '2020-06-15T12:00:00Z');
    await createCommit(sinceDir, 'new.ts', '// new', 'feat: new feature', '2024-06-15T12:00:00Z');

    const configYaml = `mining:\n  keywords: ["feat"]\n  exclude_paths: []\n  since: '2024-01-01T00:00:00Z'\n`;
    await fs.writeFile(path.join(sinceDir, 'repobench.yaml'), configYaml);

    const projectRoot = process.cwd();
    const scriptPath = path.join(projectRoot, 'src/cli/mine.ts');
    const configPath = path.join(sinceDir, 'repobench.yaml');

    const originalCwd = process.cwd();
    try {
      const stdout = execSync(
        `npx tsx "${scriptPath}" -r "${sinceDir}" -c "${configPath}" --since 2024-01-01T00:00:00Z`,
        { cwd: projectRoot, env: { ...process.env, PATH: process.env.PATH }, timeout: 30000 },
      ).toString();
      expect(stdout).toContain('Found 1 candidates.');
    } finally {
      process.chdir(originalCwd);
    }
  }, 30000);

  it('should show helpful error for invalid --since date value', async () => {
    const invalidDir = path.join(tempDir, 'cli-since-invalid');
    await fs.mkdir(invalidDir, { recursive: true });
    initRepo(invalidDir);

    await createCommit(invalidDir, 'a.ts', '// a', 'feat: commit a', '2024-06-15T12:00:00Z');

    const configYaml = `mining:\n  keywords: ["feat"]\n  exclude_paths: []\n`;
    await fs.writeFile(path.join(invalidDir, 'repobench.yaml'), configYaml);

    const projectRoot = process.cwd();
    const scriptPath = path.join(projectRoot, 'src/cli/mine.ts');
    const configPath = path.join(invalidDir, 'repobench.yaml');

    try {
      execSync(
        `npx tsx "${scriptPath}" -r "${invalidDir}" -c "${configPath}" --since not-a-date`,
        { cwd: projectRoot, env: { ...process.env, PATH: process.env.PATH }, timeout: 30000 },
      );
      expect.unreachable('Expected CLI to throw for invalid --since date');
    } catch (error: unknown) {
      const stderr = error instanceof Error ? error.message : String(error);
      expect(stderr).not.toMatch(/unknown option/i);
      expect(stderr).toMatch(/invalid|format|ISO|datetime/i);
    }
  }, 30000);

  it('should populate preFixHash for non-root commits from real git history', async () => {
    const nonRootTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repobench-nonroot-test-'));
    try {
      execSync('git init', { cwd: nonRootTempDir });
      execSync('git config user.email "test@example.com"', { cwd: nonRootTempDir });
      execSync('git config user.name "Test User"', { cwd: nonRootTempDir });

      // Root commit
      await fs.writeFile(path.join(nonRootTempDir, 'app.ts'), 'function add(a, b) { return a + b; }');
      execSync('git add .', { cwd: nonRootTempDir });
      execSync('git commit -m "feat: initial implementation"', { cwd: nonRootTempDir });

      const rootHash = execSync('git rev-parse HEAD', { cwd: nonRootTempDir }).toString().trim();

      // Non-root fix commit
      await fs.writeFile(path.join(nonRootTempDir, 'app.ts'), 'function add(a, b) { return a - b; }');
      execSync('git add .', { cwd: nonRootTempDir });
      execSync('git commit -m "fix: resolve addition bug"', { cwd: nonRootTempDir });

      const originalCwd = process.cwd();
      process.chdir(nonRootTempDir);

      try {
        const repository = { save: () => {}, upsert: () => {}, exists: () => false, getAll: () => [] };
        const miner = new GitMiner(repository);
        const config: RepoBenchConfig = {
          mining: { keywords: ['fix'], exclude_paths: [] },
        };

        const results = await miner.mineCommits(config);

        expect(results.length).toBe(1);
        const candidate: Candidate = results[0];
        expect(candidate.postFixHash).toBeDefined();
        expect(candidate.postFixHash).toBe(candidate.hash);
        expect(candidate.preFixHash).toBeDefined();
        expect(candidate.preFixHash).toBe(rootHash);
      } finally {
        process.chdir(originalCwd);
      }
    } finally {
      await fs.rm(nonRootTempDir, { recursive: true, force: true });
    }
  });

});
