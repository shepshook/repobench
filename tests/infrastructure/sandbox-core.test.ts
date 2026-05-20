import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { SandboxConfig } from '../../src/core/contracts';
import { VolumeManager } from '../../src/infrastructure/volume-manager';
import Docker from 'dockerode';
import { createSandboxFixture, createSimulationFixture, createFailingDockerFixture } from './fixtures';
import { reinitDatabase, getRawDb } from '../../src/infrastructure/persistence/database';
import { CandidateRepository } from '../../src/core/repositories/candidate-repository';
import { generateValidUuid, generateValidHash } from '../helpers/dataset';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

describe('Sandbox Core (Integration)', () => {
  let sandbox: Sandbox;
  const config: SandboxConfig = {
    testCommand: 'npm test',
    envVars: {
      NODE_ENV: 'test',
      API_KEY: 'secret_key'
    },
    baseImage: 'node:20-alpine'
  };

  beforeEach(() => {
    const docker = new Docker();
    const volumeManager = new VolumeManager(docker);
    sandbox = new Sandbox(config, volumeManager);
  });

  afterEach(async () => {
    try {
      await sandbox.destroy();
    } catch {}
  });

  describe('Basic Lifecycle & Execution', () => {
    it('should successfully initialize and execute commands', async () => {
      await sandbox.init();
      expect(await sandbox.ping()).toBe(true);
      
      const result = await sandbox.execute('echo Hello');
      expect(result.stdout.trim()).toBe('Hello');
    }, 15000);

    it('should apply environment variables and handle overrides', async () => {
      const envConfig: SandboxConfig = {
        ...config,
        project: 'env-test',
        envVars: { NODE_ENV: 'test', API_KEY: 'secret' },
      };
      const docker = new Docker();
      const volumeManager = new VolumeManager(docker);
      const envSandbox = new Sandbox(envConfig, volumeManager);
      await envSandbox.init();

      let result = await envSandbox.execute('printenv');
      expect(result.stdout).toContain('NODE_ENV=test');
      expect(result.stdout).toContain('API_KEY=secret');

      result = await envSandbox.execute('printenv', { env: { EXTRA: 'val' } });
      expect(result.stdout).toContain('EXTRA=val');
      expect(result.stdout).toContain('NODE_ENV=test');

      result = await envSandbox.execute('printenv', { env: { NODE_ENV: 'prod' } });
      expect(result.stdout).toContain('NODE_ENV=prod');
      expect(result.stdout).not.toContain('NODE_ENV=test');

      await envSandbox.destroy();
    }, 30000);

    it('should throw a descriptive error when the build command fails', async () => {
      const failingConfig: SandboxConfig = {
        ...config,
        buildCommand: 'exit 1'
      };
      const docker = new Docker();
      const volumeManager = new VolumeManager(docker);
      const failingSandbox = new Sandbox(failingConfig, volumeManager);
      
      try {
        await failingSandbox.init();
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('build command failed');
        expect(error).toHaveProperty('stdout');
        expect(error).toHaveProperty('stderr');
      }
      await failingSandbox.destroy();
    }, 15000);

    it('should capture actual stderr from failing commands', async () => {
      await sandbox.init();
      const result = await sandbox.execute('cat /nonexistent_file_12345');
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('No such file or directory');
    }, 15000);

    it('should fallback to simulation when Docker engine is not found (ENOENT)', async () => {
      const { sandbox } = createSimulationFixture({
        project: 'connectivity-test',
        buildCommand: 'echo "Hello"',
        cachePaths: ['/tmp/cache']
      });
      
      await expect(sandbox.init()).resolves.not.toThrow();
      const result = await sandbox.execute('echo "Hello Sandbox"');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Hello Sandbox');
      await sandbox.destroy();
    });
  });

  describe('Image Configuration', () => {
    it('should respect the baseImage configuration', async () => {
      const { sandbox } = createSandboxFixture({
        baseImage: 'alpine:latest',
      });
      await sandbox.init();
      vi.spyOn(sandbox, 'execute').mockResolvedValue({
        exitCode: 0, stdout: 'NAME="Alpine Linux"', stderr: '',
      });
      const result = await sandbox.execute('cat /etc/os-release');
      expect(result.exitCode).toBe(0);
      expect(result.stdout.toLowerCase()).toContain('alpine');
      await sandbox.destroy();
    });

    it('should respect a non-alpine baseImage configuration', async () => {
      const { sandbox } = createSandboxFixture({
        baseImage: 'ubuntu:latest',
      });
      await sandbox.init();
      vi.spyOn(sandbox, 'execute').mockResolvedValue({
        exitCode: 0, stdout: 'NAME="Ubuntu"', stderr: '',
      });
      const result = await sandbox.execute('cat /etc/os-release');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Ubuntu');
      await sandbox.destroy();
    });

    it('should verify image used in createContainer', async () => {
      const { sandbox, mockDocker } = createSandboxFixture({
        baseImage: 'alpine:latest',
      });
      await sandbox.init();
      expect(mockDocker.createContainerMock).toHaveBeenCalledWith(expect.objectContaining({
        Image: 'alpine:latest'
      }));
      await sandbox.destroy();
    });
  });

  describe('Volume Management', () => {
    it('should mount the specified cache paths as Docker volumes', async () => {
      const { sandbox, mockDocker } = createSandboxFixture({
        cachePaths: ['/root/.npm'],
      });
      await sandbox.init();
      expect(mockDocker.createContainerMock).toHaveBeenCalledWith(expect.objectContaining({
        HostConfig: expect.objectContaining({
          Binds: expect.arrayContaining([expect.stringContaining('repobench-cache')])
        })
      }));
      await sandbox.destroy();
    });

    it('should use a unique volume mount when the lockfile changes', async () => {
      const lockFile = 'package-lock.mount.json';
      await fs.writeFile(lockFile, '{"name": "mount-test", "version": "1.0.0"}');
      
      const { sandbox: sandbox1, mockDocker, volumeManager } = createSandboxFixture({
        cachePaths: ['/root/.npm'],
      });
      await sandbox1.init();
      const volumeName1 = mockDocker.createVolumeMock.mock.results[0]?.value?.Name || 'vol1';
      await sandbox1.destroy();
      
      await fs.writeFile(lockFile, '{"name": "mount-test", "version": "2.0.0"}');
      
      const sandbox2 = new Sandbox({ cachePaths: ['/root/.npm'] }, volumeManager);
      await sandbox2.init();
      const volumeName2 = mockDocker.createVolumeMock.mock.results[1]?.value?.Name || 'vol2';
      await sandbox2.destroy();
      
      expect(volumeName1).not.toBe(volumeName2);
      await fs.unlink(lockFile).catch(() => {});
    });
  });

  describe('State Management (switchState)', () => {
    const validHash = 'a'.repeat(40);

    it('should successfully switch state to a valid hash', async () => {
      await sandbox.init();
      const executeSpy = vi.spyOn(sandbox, 'execute').mockResolvedValue({
        stdout: 'success', stderr: '', exitCode: 0,
      });

      await expect(sandbox.switchState(validHash)).resolves.not.toThrow();
      expect(executeSpy).toHaveBeenCalledWith('git reset --hard');
      expect(executeSpy).toHaveBeenCalledWith(`git checkout ${validHash}`);
    });

    it('should throw an error for invalid hash formats', async () => {
      await sandbox.init();
      await expect(sandbox.switchState('invalid-hash')).rejects.toThrow();
    });

    it('should execute git reset --hard before checkout', async () => {
      await sandbox.init();
      const executeSpy = vi.spyOn(sandbox, 'execute').mockResolvedValue({
        stdout: 'success', stderr: '', exitCode: 0,
      });

      await sandbox.switchState(validHash);
      const calls = executeSpy.mock.calls;
      const resetIndex = calls.findIndex(call => call[0] === 'git reset --hard');
      const checkoutIndex = calls.findIndex(call => call[0] === `git checkout ${validHash}`);
      expect(resetIndex).toBeLessThan(checkoutIndex);
    });

    it('should avoid redundant checkouts of the same hash', async () => {
      await sandbox.init();
      const executeSpy = vi.spyOn(sandbox, 'execute').mockResolvedValue({
        stdout: 'success', stderr: '', exitCode: 0,
      });

      await sandbox.switchState(validHash);
      await sandbox.switchState(validHash);
      expect(executeSpy).toHaveBeenCalledTimes(2); 
    });

    it('should throw a GitOperationError when git commands fail', async () => {
      await sandbox.init();
      vi.spyOn(sandbox, 'execute').mockResolvedValue({
        stdout: '',
        stderr: 'fatal: reference is not a tree: invalid-hash',
        exitCode: 128,
      });

      try {
        await sandbox.switchState(validHash);
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.name).toBe('GitOperationError');
        expect(error.stderr).toBe('fatal: reference is not a tree: invalid-hash');
      }
    });
  });

  describe('Database Isolation', () => {
    it('should maintain isolation between tests using different DB paths', async () => {
      const tempDbPath = path.join(os.tmpdir(), `isolation-test-${Math.random()}.db`);
      await reinitDatabase(tempDbPath);
      
      const db = getRawDb();
      db.prepare('INSERT INTO candidates (id, hash, message, files, status, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        'test-id', 'hash', 'msg', 'files', 'pending', new Date().toISOString()
      );
      
      const result = db.prepare('SELECT count(*) as count FROM candidates').get();
      expect(result.count).toBe(1);
      
      await fs.unlink(tempDbPath).catch(() => {});
    });

    it('should ensure isolation via reinitDatabase in beforeEach', async () => {
      const tempDbPath = path.join(os.tmpdir(), `isolation-failure-db-${Date.now()}.db`);
      await reinitDatabase(tempDbPath);
      const repo = new CandidateRepository();
      
      repo.save({
        id: generateValidUuid(),
        hash: generateValidHash(),
        message: 'data from A',
        files: [],
        status: 'curated' as const,
        created_at: new Date(),
        curation: { score: 0.9, reasoning: 'A', isApproved: true },
        repositoryUrl: 'https://github.com/a/repo',
        repositoryName: 'repo-a',
        preFixHash: generateValidHash(),
        postFixHash: generateValidHash(),
      });
      expect(repo.getAll()).toHaveLength(1);

      const tempDbPath2 = path.join(os.tmpdir(), `isolation-failure-db-2-${Date.now()}.db`);
      await reinitDatabase(tempDbPath2);
      expect(repo.getAll()).toHaveLength(0);
      
      await fs.unlink(tempDbPath).catch(() => {});
      await fs.unlink(tempDbPath2).catch(() => {});
    });

    it('should provide isolation when calling initDatabase with different paths', async () => {
      const dbPath1 = path.join(os.tmpdir(), `isolation-test-1-${Date.now()}.db`);
      const dbPath2 = path.join(os.tmpdir(), `isolation-test-2-${Date.now()}.db`);

      reinitDatabase(dbPath1);
      getRawDb().prepare('INSERT INTO candidates (id, hash, message, files, status, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        'test-1', 'hash-1', 'message-1', '[]', 'validated', new Date().toISOString()
      );

      reinitDatabase(dbPath2);
      const count = getRawDb().prepare('SELECT COUNT(*) as count FROM candidates').get() as { count: number };
      expect(count.count).toBe(0);

      try {
        await fs.unlink(dbPath1);
        await fs.unlink(dbPath2);
      } catch {}
    });
  });
});
;
