import { describe, it, expect, vi } from 'vitest';
import { LocalSandbox, DockerSandbox } from '../../src/sandbox';
import { SandboxOptions } from '../../src/types/contracts';
import fs from 'fs/promises';
import Docker from 'dockerode';

vi.mock('dockerode');

describe('Sandbox Lifecycle Tests', () => {
  const testRepo = 'D:/dev/RepoBench/toy-repo';
  const getOptions = (): SandboxOptions => ({
    repoPath: testRepo,
    image: 'node:20-slim',
    commitHash: 'master',
  });

  describe('LocalSandbox Lifecycle', () => {
    it('should handle rapid init/destroy cycles (Stress Test)', async () => {
      const options = getOptions();
      for (let i = 0; i < 50; i++) {
        const sandbox = new LocalSandbox(options);
        await sandbox.init();
        expect(await sandbox.ping()).toBe(true);
        await sandbox.destroy();
        expect(await sandbox.ping()).toBe(false);
      }
    }, 60000);

    it('should clean up resources after partial init failure', async () => {
      const options = { ...getOptions(), repoPath: '/non/existent/repo' };
      const sandbox = new LocalSandbox(options);
      
      await expect(sandbox.init()).rejects.toThrow();
      
      const workingDir = sandbox.getWorkingDir();
      expect(workingDir).toBeDefined();
      
      await sandbox.destroy();
      
      const exists = await fs.access(workingDir).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });

    it('should be idempotent on destroy', async () => {
      const options = getOptions();
      const sandbox = new LocalSandbox(options);
      await sandbox.init();
      
      await sandbox.destroy();
      await expect(sandbox.destroy()).resolves.not.toThrow();
      await expect(sandbox.destroy()).resolves.not.toThrow();
    });
  });

  describe('DockerSandbox Lifecycle', () => {
    it('should handle Docker unavailability gracefully', async () => {
      const mockCreateContainer = vi.fn().mockRejectedValue(new Error('Docker daemon not available'));
      vi.mocked(Docker).mockImplementation(function() {
        this.createContainer = mockCreateContainer;
      });

      const options = getOptions();
      const sandbox = new DockerSandbox(options);
      
      await expect(sandbox.init()).rejects.toThrow('DockerSandbox init failed: Docker daemon not available');
    });

    it('should be idempotent on destroy', async () => {
      vi.mocked(Docker).mockImplementation(function() {
        this.createContainer = vi.fn();
      });

      const options = getOptions();
      const sandbox = new DockerSandbox(options);
      
      await expect(sandbox.destroy()).resolves.not.toThrow();
      await expect(sandbox.destroy()).resolves.not.toThrow();
    });
  });
});
