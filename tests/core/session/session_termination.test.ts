import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Session } from '../../../src/core/session/session';
import { LocalSandbox } from '../../../src/sandbox/local';
import { SandboxOptions } from '../../../src/types/contracts';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

describe('Session Termination', () => {
  let tempRepoPath: string;
  let initialHash: string;
  let sandbox: LocalSandbox;

  beforeAll(async () => {
    tempRepoPath = path.join(os.tmpdir(), `repobench-test-repo-term-${Date.now()}`);
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

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should terminate session after timeout', async () => {
    const session = new Session(sandbox);
    
    const timeoutMs = 500;
    await session.start(timeoutMs);
    
    // Advance timers to trigger timeout
    vi.advanceTimersByTime(timeoutMs);
    await Promise.resolve();
    
    // The session should have been ended by the timeout.
    const result = await session.end();
    expect(result).toBeDefined();
    expect(result.duration).toBeGreaterThanOrEqual(timeoutMs);
  }, 30000);

  it('should not terminate session before timeout', async () => {
    const session = new Session(sandbox);
    
    const timeoutMs = 2000;
    await session.start(timeoutMs);
    
    // Advance timers, but less than timeout
    vi.advanceTimersByTime(500);
    await Promise.resolve();
    
    // Session should still be active.
    const result = await session.end();
    expect(result.duration).toBeLessThan(timeoutMs);
  }, 30000);
});
