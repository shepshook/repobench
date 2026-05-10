import { describe, it, expect } from 'vitest';
import { Miner } from '../../src/core/miner';
import { RepoBenchConfig } from '../../src/core/config';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

function createFixtureRepo(name: string, setupFn: (exec: any, repoPath: string) => void) {
  const repoPath = path.join(os.tmpdir(), `repobench-keyword-test-${name}`);
  if (fs.existsSync(repoPath)) {
    fs.rmSync(repoPath, { recursive: true, force: true });
  }
  fs.mkdirSync(repoPath);
  
  execSync(`git init`, { cwd: repoPath });
  setupFn(execSync, repoPath);
  
  return repoPath;
}

describe('Miner Keyword Filtering', () => {
  it('should find commits matching custom keywords', async () => {
    const repoPath = createFixtureRepo('custom-keywords', (exec, p) => {
      execSync('git config user.email "test@example.com"', { cwd: p });
      execSync('git config user.name "Test User"', { cwd: p });
      
      fs.writeFileSync(path.join(p, 'index.js'), 'console.log("hi")');
      execSync('git add . && git commit -m "initial"', { cwd: p });
      
      fs.writeFileSync(path.join(p, 'index.js'), 'console.log("fixed")');
      fs.writeFileSync(path.join(p, 'index.test.js'), 'test("fix", () => {})');
      execSync('git add . && git commit -m "hotfix: bug in logic"', { cwd: p });
    });

    const config: RepoBenchConfig = {
      mining: { keywords: ['hotfix'], exclude_paths: [] },
      sandbox: {},
    };

    const miner = new Miner(repoPath, config);
    const candidates = await miner.mineCommits();
    
    expect(candidates.length).toBe(1);
    expect(candidates[0].message).toContain('hotfix');
  });

  it('should return zero candidates when keywords list is empty', async () => {
    const repoPath = createFixtureRepo('empty-keywords', (exec, p) => {
      execSync('git config user.email "test@example.com"', { cwd: p });
      execSync('git config user.name "Test User"', { cwd: p });
      
      fs.writeFileSync(path.join(p, 'index.js'), 'console.log("hi")');
      execSync('git add . && git commit -m "initial"', { cwd: p });
      
      fs.writeFileSync(path.join(p, 'index.js'), 'console.log("fixed")');
      fs.writeFileSync(path.join(p, 'index.test.js'), 'test("fix", () => {})');
      execSync('git add . && git commit -m "fix: bug in logic"', { cwd: p });
    });

    const config: RepoBenchConfig = {
      mining: { keywords: [], exclude_paths: [] },
      sandbox: {},
    };

    const miner = new Miner(repoPath, config);
    const candidates = await miner.mineCommits();
    
    expect(candidates.length).toBe(0);
  });
});
