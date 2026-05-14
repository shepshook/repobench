import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Session } from '../../../src/core/session/session';
import { LocalSandbox } from '../../../src/sandbox/local';
import { SandboxOptions } from '../../../src/types/contracts';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

describe('Session Integration', () => {
  let tempRepoPath: string;
  let initialHash: string;
  let sandbox: LocalSandbox;

  beforeAll(async () => {
    tempRepoPath = path.join(os.tmpdir(), `repobench-test-repo-${Date.now()}`);
    await fs.mkdir(tempRepoPath, { recursive: true });
    
    execSync('git init', { cwd: tempRepoPath });
    await fs.writeFile(path.join(tempRepoPath, 'README.md'), '# Test Repo');
    execSync('git add .', { cwd: tempRepoPath });
    execSync('git commit -m "Initial commit"', { cwd: tempRepoPath });
    
    initialHash = execSync('git rev-parse HEAD', { cwd: tempRepoPath }).toString().trim();

    const options: SandboxOptions = {
      repoPath: tempRepoPath,
      image: 'ubuntu:latest',
      commitHash: initialHash,
    };
    sandbox = new LocalSandbox(options);
  }, 30000);

  afterAll(async () => {
    await sandbox.destroy();
    await fs.rm(tempRepoPath, { recursive: true, force: true });
  });

  it('should throw error when writing before start', async () => {
    const session = new Session(sandbox);
    await expect(session.write('echo hello')).rejects.toThrow('Session not started. Call start() first.');
  });

  it('should track file modifications and opens correctly', async () => {
    const session = new Session(sandbox);
    try {
      await session.start();

      // write('echo hello > test.txt')
      await session.write('echo hello > test.txt');
      
      // write('cat test.txt')
      await session.write('cat test.txt');
      
      // write('rm test.txt')
      await session.write('rm test.txt');

      const result = await session.end();

      expect(result.filesModified).toBe(1);
      expect(result.filesOpened).toBe(1);
      expect(result.duration).toBeGreaterThan(0);
    } finally {
      await session.end().catch(() => {});
    }
  }, 30000);

  it('should track files without extensions', async () => {
    const session = new Session(sandbox);
    try {
      await session.start();
      await session.write('Set-Content -Path no_ext -Value "hello"');
      await session.write('Get-Content no_ext');
      const result = await session.end();
      expect(result.filesModified).toBe(1);
      expect(result.filesOpened).toBe(1);
    } finally {
      await session.end().catch(() => {});
    }
  }, 30000);

  it('should track implicit modifications', async () => {
    const session = new Session(sandbox);
    try {
      await session.start();
      await session.write('Set-Content -Path file1.txt -Value "file1"');
      await session.write('Set-Content -Path file2.txt -Value "file2"');
      // Modify all .txt files implicitly using PowerShell
      await session.write('Get-ChildItem -Filter *.txt | ForEach-Object { Add-Content $_.FullName "updated" }');
      const result = await session.end();
      expect(result.filesModified).toBe(2);
    } finally {
      await session.end().catch(() => {});
    }
  }, 30000);

  it('should verify SessionResult content', async () => {
    const session = new Session(sandbox);
    try {
      await session.start();
      
      await session.write('echo "content" > result.txt');
      const result = await session.end();
      
      expect(result).toHaveProperty('stdout');
      expect(result).toHaveProperty('stderr');
      expect(result).toHaveProperty('exitCode');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('tokensUsed');
      expect(result).toHaveProperty('cost');
      expect(result).toHaveProperty('filesOpened');
      expect(result).toHaveProperty('filesModified');
    } finally {
      await session.end().catch(() => {});
    }
  }, 30000);
});
