import { LocalSandbox } from '../../src/sandbox/local';
import { DockerSandbox } from '../../src/sandbox/docker';
import { SandboxOptions } from '../../src/types/contracts';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { describe, it, expect, beforeEach } from 'vitest';

const mockOptions: SandboxOptions = {
  repoPath: 'https://github.com/anomalyco/opencode', // Using a real small repo or dummy
  image: 'node:20',
  commitHash: 'main',
};

describe('Sandbox Cleanup & Timeout', () => {
  describe('LocalSandbox', () => {
    let sandbox: LocalSandbox;

    beforeEach(async () => {
      sandbox = new LocalSandbox(mockOptions);
      // Mock init to avoid slow git clone
      (sandbox as any).init = async () => {
        const tempDir = (sandbox as any).tempDir;
        await fs.mkdir(tempDir, { recursive: true });
      };
      await sandbox.init();
    }, 20000);

    it('should be idempotent on destroy()', async () => {
      await sandbox.destroy();
      await expect(sandbox.destroy()).resolves.not.toThrow();
    });

    it('should timeout long running commands', async () => {
      await expect(sandbox.execute('ping 127.0.0.1 -n 10', 100)).rejects.toThrow('TimeoutError');
    });

    it('should remove temp directory on destroy()', async () => {
      const dir = sandbox.getWorkingDir();
      await sandbox.destroy();
      await expect(fs.access(dir)).rejects.toThrow();
    });
  });

  describe('DockerSandbox', () => {
    let sandbox: DockerSandbox;

    beforeEach(async () => {
      sandbox = new DockerSandbox(mockOptions);
      // Mock init to avoid Docker dependency in CI/local if not available
      (sandbox as any).init = async () => {
        (sandbox as any).hostTempDir = path.join(os.tmpdir(), `repobench-docker-test-${crypto.randomUUID()}`);
        await fs.mkdir((sandbox as any).hostTempDir, { recursive: true });
        (sandbox as any).container = {
          exec: async () => ({
            start: async () => {
              return new (require('events').EventEmitter)();
            },
            stop: async () => {},
            inspect: async () => ({ ExitCode: 0 }),
          }),
          stop: async () => {},
          remove: async () => {},
        };
      };
      await sandbox.init();
    }, 20000);

    it('should be idempotent on destroy()', async () => {
      await sandbox.destroy();
      await expect(sandbox.destroy()).resolves.not.toThrow();
    });

    it('should timeout long running commands', async () => {
      // Since we mocked container.exec, we need to make sure it behaves like it would
      // For now, let's just check if it throws TimeoutError when we provide a timeout
      // We might need a better mock for this.
      await expect(sandbox.execute('sleep 10', 100)).rejects.toThrow('TimeoutError');
    });

    it('should remove resources on destroy()', async () => {
      const dir = (sandbox as any).hostTempDir;
      await sandbox.destroy();
      await expect(fs.access(dir)).rejects.toThrow();
    });
  });
});
