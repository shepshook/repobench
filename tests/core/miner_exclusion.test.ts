import { describe, it, expect } from 'vitest';
import { Miner } from '../../src/core/miner';
import { RepoBenchConfig } from '../../src/core/config';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

function createFixtureRepo(name: string, setupFn: (exec: any, repoPath: string) => void) {
  const repoPath = path.join(os.tmpdir(), `repobench-exclusion-test-${name}`);
  if (fs.existsSync(repoPath)) {
    fs.rmSync(repoPath, { recursive: true, force: true });
  }
  fs.mkdirSync(repoPath);
  
  execSync(`git init`, { cwd: repoPath });
  setupFn(execSync, repoPath);
  
  return repoPath;
}

describe('Miner Path Exclusion', () => {
  it('should capture candidates when excluded paths are not the only changes', async () => {
    const repoPath = createFixtureRepo('mixed-files', (exec, p) => {
      execSync('git config user.email "test@example.com"', { cwd: p });
      execSync('git config user.name "Test User"', { cwd: p });
      
      fs.writeFileSync(path.join(p, 'index.js'), 'console.log("hi")');
      execSync('git add . && git commit -m "initial"', { cwd: p });
      
      fs.mkdirSync(path.join(p, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(p, 'index.js'), 'console.log("fixed")');
      fs.writeFileSync(path.join(p, 'index.test.js'), 'test("fix", () => {})');
      fs.writeFileSync(path.join(p, 'docs/readme.md'), 'Updated docs');
      execSync('git add . && git commit -m "fix: bug and update docs"', { cwd: p });
    });

    const config: RepoBenchConfig = {
      mining: { keywords: ['fix'], exclude_paths: ['docs/'] },
      sandbox: {},
    };

    const miner = new Miner(repoPath, config);
    const candidates = await miner.mineCommits();
    
    expect(candidates.length).toBe(1);
    expect(candidates[0].files).not.toContain('docs/readme.md');
    expect(candidates[0].files).toContain('index.js');
  });

  it('should ignore commits that only modify excluded paths', async () => {
    const repoPath = createFixtureRepo('only-excluded', (exec, p) => {
      execSync('git config user.email "test@example.com"', { cwd: p });
      execSync('git config user.name "Test User"', { cwd: p });
      
      fs.writeFileSync(path.join(p, 'index.js'), 'console.log("hi")');
      execSync('git add . && git commit -m "initial"', { cwd: p });
      
      fs.mkdirSync(path.join(p, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(p, 'docs/readme.md'), 'updated');
      fs.writeFileSync(path.join(p, 'docs/test.md'), 'test');
      execSync('git add . && git commit -m "fix: update docs only"', { cwd: p });
    });

    const config: RepoBenchConfig = {
      mining: { keywords: ['fix'], exclude_paths: ['docs/'] },
      sandbox: {},
    };

    const miner = new Miner(repoPath, config);
    const candidates = await miner.mineCommits();
    
    expect(candidates.length).toBe(0);
  });
});
