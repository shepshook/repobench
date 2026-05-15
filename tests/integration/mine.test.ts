import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

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
    
    const stdout = execSync(`node --loader ts-node/esm ${scriptPath} -r ${tempDir} -c ${configPath}`, { 
      cwd: projectRoot, 
      env: { ...process.env, PATH: process.env.PATH } 
    }).toString();

    expect(stdout).toContain('Found 2 candidates.');
  });

});
