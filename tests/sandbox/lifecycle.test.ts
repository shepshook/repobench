import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalSandbox } from '../../src/sandbox/local';
import { DockerSandbox } from '../../src/sandbox/docker';
import { SandboxOptions } from '../../src/types/contracts';
import { spawn } from 'child_process';
import Docker from 'dockerode';
import os from 'os';
import fs from 'fs/promises';
import path from 'path';

vi.mock('child_process', async () => {
  const actual = await vi.importActual('child_process');
  return {
    ...actual,
    spawn: vi.fn(),
  };
});

vi.mock('dockerode');

describe('Sandbox Lifecycle Tests', () => {
  const mockOptions: SandboxOptions = {
    repoPath: 'https://github.com/test/repo',
    image: 'ubuntu:latest',
    commitHash: 'main',
    envVars: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('LocalSandbox', () => {
    const createMockProcess = (exitCode: number) => ({
      on: vi.fn().mockImplementation(function(event, cb) {
        if (event === 'close') cb(exitCode);
        return this;
      }),
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      kill: vi.fn(),
    });

    it('should handle stress test: rapid init and destroy', async () => {
      (spawn as any).mockImplementation(() => createMockProcess(0));

      // Clean up existing leaks before starting
      const initialDirs = await fs.readdir(os.tmpdir());
      for (const dir of initialDirs.filter(d => d.startsWith('repobench-local-'))) {
        await fs.rm(path.join(os.tmpdir(), dir), { recursive: true, force: true });
      }

      for (let i = 0; i < 50; i++) {
        const sandbox = new LocalSandbox(mockOptions);
        await sandbox.init();
        await sandbox.destroy();
      }

      const dirs = await fs.readdir(os.tmpdir());
      const leaks = dirs.filter(d => d.startsWith('repobench-local-'));
      expect(leaks.length).toBe(0);
    });

    it('should handle concurrent init and destroy', async () => {
      (spawn as any).mockImplementation(() => createMockProcess(0));

      // Clean up existing leaks before starting
      const initialDirs = await fs.readdir(os.tmpdir());
      for (const dir of initialDirs.filter(d => d.startsWith('repobench-local-'))) {
        await fs.rm(path.join(os.tmpdir(), dir), { recursive: true, force: true });
      }

      const sandboxes = Array.from({ length: 10 }, () => new LocalSandbox(mockOptions));
      await Promise.all(sandboxes.map(s => s.init()));
      await Promise.all(sandboxes.map(s => s.destroy()));

      const dirs = await fs.readdir(os.tmpdir());
      const leaks = dirs.filter(d => d.startsWith('repobench-local-'));
      expect(leaks.length).toBe(0);
    });

    it('should recover from partial init failure', async () => {
      (spawn as any).mockImplementation(() => createMockProcess(1));

      const sandbox = new LocalSandbox({ ...mockOptions, repoPath: 'invalid-repo' });
      
      await expect(sandbox.init()).rejects.toThrow();
      
      await sandbox.destroy();
      expect(await sandbox.ping()).toBe(false);
    });

    it('should be idempotent when calling destroy multiple times', async () => {
      (spawn as any).mockImplementation(() => createMockProcess(0));

      const sandbox = new LocalSandbox(mockOptions);
      await sandbox.init();
      await sandbox.destroy();
      await expect(sandbox.destroy()).resolves.not.toThrow();
      await expect(sandbox.destroy()).resolves.not.toThrow();
    });
  });

  describe('DockerSandbox', () => {
    it('should handle Docker unavailability gracefully', async () => {
      vi.mocked(Docker).mockImplementationOnce(() => {
        throw new Error('Docker daemon not available');
      });

      expect(() => new DockerSandbox(mockOptions)).toThrow('Docker daemon not available');
    });

    it('should handle Docker API failure during init', async () => {
      const mockContainer = {
        start: vi.fn().mockRejectedValue(new Error('Container start failed')),
        remove: vi.fn().mockResolvedValue({}),
        stop: vi.fn().mockResolvedValue({}),
      };
      
      vi.mocked(Docker).mockImplementation(function() {
        return {
          createContainer: vi.fn().mockResolvedValue(mockContainer),
        };
      });

      const sandbox = new DockerSandbox(mockOptions);
      await expect(sandbox.init()).rejects.toThrow('DockerSandbox init failed: Container start failed');
      
      const workingDir = sandbox.getWorkingDir();
      expect(workingDir).not.toBe('');

      await sandbox.destroy();
      
      expect(mockContainer.remove).toHaveBeenCalled();
      expect(sandbox.getWorkingDir()).toBe('');
      
      // Verify hostTempDir was deleted
      await expect(fs.access(workingDir)).rejects.toThrow();
    });
  });
});
