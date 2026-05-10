import { describe, it, expect } from 'vitest';
import { Miner } from '../../src/core/miner';
import { RepoBenchConfig } from '../../src/core/config';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

function createFixtureRepo(name: string, setupFn: (exec: any, repoPath: string) => void) {
  const repoPath = path.join(os.tmpdir(), `repobench-quality-test-${name}`);
  if (fs.existsSync(repoPath)) {
    fs.rmSync(repoPath, { recursive: true, force: true });
  }
  fs.mkdirSync(repoPath);
  
  execSync(`git init`, { cwd: repoPath });
  setupFn(execSync, repoPath);
  
  return repoPath;
}

describe('Miner Quality Filter', () => {
  const config: RepoBenchConfig = {
    mining: { keywords: ['fix'], exclude_paths: [] },
    sandbox: {},
  };

  it('should capture significant source AND significant test changes', async () => {
    const repoPath = createFixtureRepo('sig-sig', (exec, p) => {
      execSync('git config user.email "test@example.com"', { cwd: p });
      execSync('git config user.name "Test User"', { cwd: p });
      
      fs.writeFileSync(path.join(p, 'index.js'), 'console.log("hi")');
      execSync('git add . && git commit -m "initial"', { cwd: p });
      
      fs.writeFileSync(path.join(p, 'index.js'), 'console.log("fixed")');
      fs.writeFileSync(path.join(p, 'index.test.js'), 'test("fix", () => {})');
      execSync('git add . && git commit -m "fix: real bug"', { cwd: p });
    });

    const miner = new Miner(repoPath, config);
    const candidates = await miner.mineCommits();
    expect(candidates.length).toBe(1);
  });

  it('should ignore trivial source changes', async () => {
    const repoPath = createFixtureRepo('triv-sig', (exec, p) => {
      execSync('git config user.email "test@example.com"', { cwd: p });
      execSync('git config user.name "Test User"', { cwd: p });
      
      fs.writeFileSync(path.join(p, 'index.js'), 'console.log("hi")');
      execSync('git add . && git commit -m "initial"', { cwd: p });
      
      // Add a separate line that is only a comment
      fs.appendFileSync(path.join(p, 'index.js'), '\n// trivial comment');
      execSync('git add . && git commit -m "fix: trivial change"', { cwd: p });
    });

    const miner = new Miner(repoPath, config);
    const candidates = await miner.mineCommits();
    expect(candidates.length).toBe(0);
  });

  it('should ignore trivial test changes', async () => {
    const repoPath = createFixtureRepo('sig-triv', (exec, p) => {
      execSync('git config user.email "test@example.com"', { cwd: p });
      execSync('git config user.name "Test User"', { cwd: p });
      
      fs.writeFileSync(path.join(p, 'index.js'), 'console.log("hi")');
      execSync('git add . && git commit -m "initial"', { cwd: p });
      
      fs.writeFileSync(path.join(p, 'index.js'), 'console.log("fixed")');
      fs.writeFileSync(path.join(p, 'index.test.js'), '  // just whitespace');
      execSync('git add . && git commit -m "fix: trivial test"', { cwd: p });
    });

    const miner = new Miner(repoPath, config);
    const candidates = await miner.mineCommits();
    expect(candidates.length).toBe(0);
  });
});
