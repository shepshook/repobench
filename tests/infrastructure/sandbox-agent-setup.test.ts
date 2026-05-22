import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { SandboxConfig } from '../../src/core/contracts';
import { VolumeManager } from '../../src/infrastructure/volume-manager';
import { MockDocker } from '../mocks/docker.mock';

describe('Sandbox Agent Setup Commands', () => {
  describe('Docker mode', () => {
    let sandbox: Sandbox;
    let mockDocker: MockDocker;

    afterEach(async () => {
      try { await sandbox.destroy(); } catch { /* ignore */ }
    });

    function createFixture(overrides: Partial<SandboxConfig> = {}) {
      const config: SandboxConfig = {
        baseImage: 'node:20-alpine',
        project: 'agent-setup-test',
        envVars: {},
        ...overrides,
      };

      mockDocker = new MockDocker();
      mockDocker.setupGetImageSuccess();
      mockDocker.setupCreateContainerSuccess();

      const volumeManager = new VolumeManager(mockDocker);
      sandbox = new Sandbox(config, volumeManager);
      return { sandbox, mockDocker, config };
    }

    it('should execute a single agentSetupCommand after buildCommand', async () => {
      createFixture({
        buildCommand: 'echo build',
        agentSetupCommands: ['echo agent-setup'],
      });

      await sandbox.init();

      const container = sandbox.getContainer()!;
      expect(container.exec).toHaveBeenCalledTimes(2);
      expect(container.exec).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ Cmd: expect.arrayContaining(['echo build']) }),
      );
      expect(container.exec).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ Cmd: expect.arrayContaining(['echo agent-setup']) }),
      );
    }, 15000);

    it('should execute multiple agentSetupCommands sequentially', async () => {
      createFixture({
        buildCommand: 'echo build',
        agentSetupCommands: [
          'npm config set registry https://registry.npmjs.org',
          'npm install -g opencode',
          'opcode --version',
        ],
      });

      await sandbox.init();

      const container = sandbox.getContainer()!;
      expect(container.exec).toHaveBeenCalledTimes(4); // build + 3 setup
      expect(container.exec).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ Cmd: expect.arrayContaining(['echo build']) }),
      );
      expect(container.exec).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ Cmd: expect.arrayContaining(['npm config set registry https://registry.npmjs.org']) }),
      );
      expect(container.exec).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ Cmd: expect.arrayContaining(['npm install -g opencode']) }),
      );
      expect(container.exec).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({ Cmd: expect.arrayContaining(['opcode --version']) }),
      );
    }, 15000);

    it('should throw a descriptive error when an agentSetupCommand exits non-zero', async () => {
      createFixture({
        buildCommand: 'echo build',
        agentSetupCommands: ['exit 1'],
      });

      let execCallCount = 0;
      mockDocker.createContainerMock.mockImplementation(() => ({
        id: 'mock-container-id',
        start: vi.fn().mockResolvedValue({}),
        stop: vi.fn().mockResolvedValue({}),
        remove: vi.fn().mockResolvedValue({}),
        inspect: vi.fn().mockResolvedValue({ State: { Running: true } }),
        exec: vi.fn().mockImplementation(() => {
          execCallCount++;
          const isSetupCommand = execCallCount > 1;
          return Promise.resolve({
            start: () => Promise.resolve({
              on: (event: string, cb: (data?: Buffer) => void) => {
                if (isSetupCommand && event === 'data') {
                  cb(Buffer.from(
                    '\x01\x00\x00\x00\x0c' + 'error stdout' +
                    '\x02\x00\x00\x00\x0c' + 'error stderr',
                  ));
                }
                if (event === 'end') cb();
              },
            }),
            inspect: () => Promise.resolve({ ExitCode: isSetupCommand ? 1 : 0, ID: '', Running: false, ProcessConfig: { arguments: [], entrypoint: '' } }),
          });
        }),
      }));

      await expect(sandbox.init()).rejects.toThrow(/Agent setup command failed/);
    }, 15000);

    it('should include stdout and stderr when an agentSetupCommand fails', async () => {
      createFixture({
        buildCommand: 'echo build',
        agentSetupCommands: ['exit 1'],
      });

      let execCallCount = 0;
      mockDocker.createContainerMock.mockImplementation(() => ({
        id: 'mock-container-id',
        start: vi.fn().mockResolvedValue({}),
        stop: vi.fn().mockResolvedValue({}),
        remove: vi.fn().mockResolvedValue({}),
        inspect: vi.fn().mockResolvedValue({ State: { Running: true } }),
        exec: vi.fn().mockImplementation(() => {
          execCallCount++;
          const isSetupCommand = execCallCount > 1;
          return Promise.resolve({
            start: () => Promise.resolve({
              on: (event: string, cb: (data?: Buffer) => void) => {
                if (isSetupCommand && event === 'data') {
                  cb(Buffer.from(
                    '\x01\x00\x00\x00\x0c' + 'error stdout' +
                    '\x02\x00\x00\x00\x0c' + 'error stderr',
                  ));
                }
                if (event === 'end') cb();
              },
            }),
            inspect: () => Promise.resolve({ ExitCode: isSetupCommand ? 1 : 0, ID: '', Running: false, ProcessConfig: { arguments: [], entrypoint: '' } }),
          });
        }),
      }));

      try {
        await sandbox.init();
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('Agent setup command failed');
        expect(error).toHaveProperty('stdout');
        expect(error).toHaveProperty('stderr');
      }
    }, 15000);

    it('should initialize successfully when agentSetupCommands is undefined', async () => {
      createFixture({ buildCommand: 'echo build' });

      await expect(sandbox.init()).resolves.not.toThrow();
      expect(sandbox.isSimulation).toBe(false);
    }, 15000);

    it('should initialize successfully when agentSetupCommands is an empty array', async () => {
      createFixture({
        buildCommand: 'echo build',
        agentSetupCommands: [],
      });

      await expect(sandbox.init()).resolves.not.toThrow();
      const container = sandbox.getContainer()!;
      expect(container.exec).toHaveBeenCalledTimes(1); // build only
    }, 15000);

    it('should initialize successfully when only agentSetupCommands is present (no buildCommand)', async () => {
      createFixture({ agentSetupCommands: ['echo no-build'] });

      await sandbox.init();

      const container = sandbox.getContainer()!;
      expect(container.exec).toHaveBeenCalledTimes(1); // agent setup only
      expect(container.exec).toHaveBeenCalledWith(
        expect.objectContaining({ Cmd: expect.arrayContaining(['echo no-build']) }),
      );
    }, 15000);
  });

  describe('Docker mode — edge cases', () => {
    let sandbox: Sandbox;
    let mockDocker: MockDocker;

    afterEach(async () => {
      try { await sandbox.destroy(); } catch { /* ignore */ }
    });

    function createFixture(overrides: Partial<SandboxConfig> = {}) {
      const config: SandboxConfig = {
        baseImage: 'node:20-alpine',
        project: 'agent-setup-edge',
        envVars: {},
        ...overrides,
      };

      mockDocker = new MockDocker();
      mockDocker.setupGetImageSuccess();
      mockDocker.setupCreateContainerSuccess();

      const volumeManager = new VolumeManager(mockDocker);
      sandbox = new Sandbox(config, volumeManager);
      return { sandbox, mockDocker, config };
    }

    it('should propagate non-Docker errors thrown by runDockerCommand during agent setup', async () => {
      createFixture({
        buildCommand: 'echo build',
        agentSetupCommands: ['failing-cmd'],
      });

      let execCallCount = 0;
      mockDocker.createContainerMock.mockImplementation(() => ({
        id: 'mock-container-id',
        start: vi.fn().mockResolvedValue({}),
        stop: vi.fn().mockResolvedValue({}),
        remove: vi.fn().mockResolvedValue({}),
        inspect: vi.fn().mockResolvedValue({ State: { Running: true } }),
        exec: vi.fn().mockImplementation(() => {
          execCallCount++;
          const isSetupCommand = execCallCount > 1;
          if (isSetupCommand) {
            return Promise.reject(new Error('Container exec failed: connection reset'));
          }
          return Promise.resolve({
            start: () => Promise.resolve({
              on: (_event: string, cb: (data?: Buffer) => void) => {
                if (_event === 'data') cb(Buffer.from('\x01\x00\x00\x00\x06build\n'));
                if (_event === 'end') cb();
              },
            }),
            inspect: () => Promise.resolve({ ExitCode: 0, ID: '', Running: false, ProcessConfig: { arguments: [], entrypoint: '' } }),
          });
        }),
      }));

      await expect(sandbox.init()).rejects.toThrow(/Container exec failed: connection reset/);
      expect(sandbox.isSimulation).toBe(false);
    }, 15000);

    it('should not execute agentSetupCommands when buildCommand fails', async () => {
      createFixture({
        buildCommand: 'exit 1',
        agentSetupCommands: ['echo should-not-run'],
      });

      let execCallCount = 0;
      mockDocker.createContainerMock.mockImplementation(() => ({
        id: 'mock-container-id',
        start: vi.fn().mockResolvedValue({}),
        stop: vi.fn().mockResolvedValue({}),
        remove: vi.fn().mockResolvedValue({}),
        inspect: vi.fn().mockResolvedValue({ State: { Running: true } }),
        exec: vi.fn().mockImplementation(() => {
          execCallCount++;
          return Promise.resolve({
            start: () => Promise.resolve({
              on: (_event: string, cb: (data?: Buffer) => void) => {
                if (_event === 'data') cb(Buffer.from('\x01\x00\x00\x00\x08error out\x02\x00\x00\x00\x08error err'));
                if (_event === 'end') cb();
              },
            }),
            inspect: () => Promise.resolve({ ExitCode: 1, ID: '', Running: false, ProcessConfig: { arguments: [], entrypoint: '' } }),
          });
        }),
      }));

      try {
        await sandbox.init();
        expect.fail('Should have thrown');
      } catch {
        expect(execCallCount).toBe(1);
      }
    }, 15000);
  });

  describe('Simulation mode', () => {
    afterEach(async () => {
      try {
        const sandbox = (globalThis as any).__lastSandbox as Sandbox;
        if (sandbox) await sandbox.destroy();
      } catch { /* ignore */ }
    });

    it('should log agentSetupCommands without executing them', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mockDocker = new MockDocker();
      mockDocker.setupGetImageSuccess();

      let createContainerCalled = false;
      mockDocker.createContainerMock.mockRejectedValue({
        code: 'ENOENT',
        message: 'connect ENOENT //./pipe/docker_engine',
      });

      const volumeManager = new VolumeManager(mockDocker);
      const sandbox = new Sandbox({
        baseImage: 'node:20-alpine',
        project: 'agent-setup-sim',
        agentSetupCommands: ['npm install -g opencode', 'opcode --version'],
      }, volumeManager);
      (globalThis as any).__lastSandbox = sandbox;

      await sandbox.init();

      expect(sandbox.isSimulation).toBe(true);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AgentSetup][Simulation] Skipping: npm install -g opencode'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AgentSetup][Simulation] Skipping: opcode --version'),
      );

      logSpy.mockRestore();
      await sandbox.destroy();
    });

    it('should initialize successfully with agentSetupCommands in simulation mode', async () => {
      const mockDocker = new MockDocker();
      mockDocker.setupGetImageSuccess();
      mockDocker.createContainerMock.mockRejectedValue({
        code: 'ENOENT',
        message: 'connect ENOENT //./pipe/docker_engine',
      });

      const volumeManager = new VolumeManager(mockDocker);
      const sandbox = new Sandbox({
        baseImage: 'node:20-alpine',
        project: 'agent-setup-sim-2',
        agentSetupCommands: ['should-not-execute'],
      }, volumeManager);
      (globalThis as any).__lastSandbox = sandbox;

      await expect(sandbox.init()).resolves.not.toThrow();
      expect(sandbox.isSimulation).toBe(true);

      await sandbox.destroy();
    });

    it('should not throw even if agentSetupCommands would fail in Docker mode', async () => {
      const mockDocker = new MockDocker();
      mockDocker.setupGetImageSuccess();
      mockDocker.createContainerMock.mockRejectedValue({
        code: 'ENOENT',
        message: 'connect ENOENT //./pipe/docker_engine',
      });

      const volumeManager = new VolumeManager(mockDocker);
      const sandbox = new Sandbox({
        baseImage: 'node:20-alpine',
        project: 'agent-setup-sim-3',
        agentSetupCommands: ['exit 1'],
      }, volumeManager);
      (globalThis as any).__lastSandbox = sandbox;

      await expect(sandbox.init()).resolves.not.toThrow();
      expect(sandbox.isSimulation).toBe(true);

      await sandbox.destroy();
    });

    it('should handle undefined agentSetupCommands in simulation mode', async () => {
      const mockDocker = new MockDocker();
      mockDocker.setupGetImageSuccess();
      mockDocker.createContainerMock.mockRejectedValue({
        code: 'ENOENT',
        message: 'connect ENOENT //./pipe/docker_engine',
      });

      const volumeManager = new VolumeManager(mockDocker);
      const sandbox = new Sandbox({
        baseImage: 'node:20-alpine',
        project: 'agent-setup-sim-4',
      }, volumeManager);
      (globalThis as any).__lastSandbox = sandbox;

      await expect(sandbox.init()).resolves.not.toThrow();
      expect(sandbox.isSimulation).toBe(true);
      await sandbox.destroy();
    });

    it('should handle empty agentSetupCommands array in simulation mode', async () => {
      const mockDocker = new MockDocker();
      mockDocker.setupGetImageSuccess();
      mockDocker.createContainerMock.mockRejectedValue({
        code: 'ENOENT',
        message: 'connect ENOENT //./pipe/docker_engine',
      });

      const volumeManager = new VolumeManager(mockDocker);
      const sandbox = new Sandbox({
        baseImage: 'node:20-alpine',
        project: 'agent-setup-sim-5',
        agentSetupCommands: [],
      }, volumeManager);
      (globalThis as any).__lastSandbox = sandbox;

      await expect(sandbox.init()).resolves.not.toThrow();
      expect(sandbox.isSimulation).toBe(true);
      await sandbox.destroy();
    });
  });
});
