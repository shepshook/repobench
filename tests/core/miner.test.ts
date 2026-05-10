import { describe, it, expect } from 'vitest';
import { Miner } from '../../src/core/miner';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

function createFixtureRepo(name: string, setupFn: (exec: any, repoPath: string) => void) {
  const repoPath = path.join(os.tmpdir(), `repobench-fixture-${name}`);
  if (fs.existsSync(repoPath)) {
    fs.rmSync(repoPath, { recursive: true, force: true });
  }
  fs.mkdirSync(repoPath);
  
  execSync(`git init`, { cwd: repoPath });
  setupFn(execSync, repoPath);
  
  return repoPath;
}

describe('Miner', () => {
  it('should find pure fixes in a repo', async () => {
    const repoPath = createFixtureRepo('pure-fixes', (exec, p) => {
      execSync('git config user.email "test@example.com"', { cwd: p });
      execSync('git config user.name "Test User"', { cwd: p });
      
      // Initial commit
      fs.writeFileSync(path.join(p, 'index.js'), 'console.log("hi")');
      execSync('git add . && git commit -m "initial"', { cwd: p });
      
      // Pure fix commit
      fs.writeFileSync(path.join(p, 'index.js'), 'console.log("fixed")');
      fs.writeFileSync(path.join(p, 'index.test.js'), 'test("fix", () => {})');
      execSync('git add . && git commit -m "fix: bug in logic"', { cwd: p });
    });

    const miner = new Miner(repoPath);
    const candidates = await miner.mineCommits();
    
    expect(candidates.length).toBe(1);
    expect(candidates[0].message).toContain('fix: bug in logic');
    expect(candidates[0].files).toContain('index.js');
    expect(candidates[0].files).toContain('index.test.js');
  });

  it('should ignore noisy commits that lack test changes', async () => {
    const repoPath = createFixtureRepo('noisy-fixes', (exec, p) => {
      execSync('git config user.email "test@example.com"', { cwd: p });
      execSync('git config user.name "Test User"', { cwd: p });
      
      fs.writeFileSync(path.join(p, 'index.js'), 'console.log("hi")');
      execSync('git add . && git commit -m "initial"', { cwd: p });
      
      // Noisy commit: fix in message, but only source change
      fs.writeFileSync(path.join(p, 'index.js'), 'console.log("fixed but no test")');
      execSync('git add . && git commit -m "fix: bug but lazy"', { cwd: p });
    });

    const miner = new Miner(repoPath);
    const candidates = await miner.mineCommits();
    
    expect(candidates.length).toBe(0);
  });
});
