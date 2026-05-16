import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { GitMiner } from '../../src/core/services/miner.js';
import type { RepoBenchConfig } from '../../src/core/config.js';

describe('Mine CLI Integration Test', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repobench-cli-test-'));
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

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
      } finally {
        process.chdir(originalCwd);
      }
    } finally {
      await fs.rm(sigTempDir, { recursive: true, force: true });
    }
  });

});
