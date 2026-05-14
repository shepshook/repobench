import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Session } from '../../src/core/session/session';
import { LocalSandbox } from '../../src/sandbox/local';
import { RepoBenchConfig } from '../../src/core/config';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

describe('Session Efficiency Tracking', () => {
  let toyRepoPath: string;
  let config: RepoBenchConfig;

  beforeEach(async () => {
    toyRepoPath = path.join(os.tmpdir(), `repobench-test-repo-${Date.now()}`);
    await fs.mkdir(toyRepoPath, { recursive: true });
    execSync('git init', { cwd: toyRepoPath });
    execSync('git config user.email "test@test.com"', { cwd: toyRepoPath });
    execSync('git config user.name "Test User"', { cwd: toyRepoPath });
    
    await fs.writeFile(path.join(toyRepoPath, 'file1.txt'), 'original content 1');
    execSync('git add file1.txt', { cwd: toyRepoPath });
    execSync('git commit -m "initial commit"', { cwd: toyRepoPath });

    await fs.writeFile(path.join(toyRepoPath, 'file2.txt'), 'original content 2');
    execSync('git add file2.txt', { cwd: toyRepoPath });
    execSync('git commit -m "second commit"', { cwd: toyRepoPath });

    config = {
      mining: { keywords: [], exclude_paths: [], source_extensions: [] },
      sandbox: { build_command: '', test_command: '', env_vars: {} },
      llm: { model: 'gpt-4o-mini' },
    };
  });

  afterEach(async () => {
    await fs.rm(toyRepoPath, { recursive: true, force: true });
  });

  it('should track opened and modified files correctly', async () => {
    const sandbox = new LocalSandbox({
      repoPath: toyRepoPath,
      image: 'node:20-slim',
      commitHash: 'master',
    });
    await sandbox.init();

    const session = new Session(sandbox);
    await session.start();

    // 1. Open a file
    await session.write('cat file1.txt');
    
    // 2. Modify a file
    await session.write('echo "new content" > file2.txt');

    const result = await session.end();
    await sandbox.destroy();

    expect(result.filesOpened).toBeGreaterThanOrEqual(1);
    expect(result.filesModified).toBe(1);
  });

  it('should handle multiple modifications', async () => {
    const sandbox = new LocalSandbox({
      repoPath: toyRepoPath,
      image: 'node:20-slim',
      commitHash: 'master',
    });
    await sandbox.init();

    const session = new Session(sandbox);
    await session.start();

    await session.write('echo "mod 1" > file1.txt');
    await session.write('echo "mod 2" > file2.txt');

    const result = await session.end();
    await sandbox.destroy();

    expect(result.filesModified).toBe(2);
  });
});
