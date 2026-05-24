import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { VolumeManager } from '../../src/infrastructure/volume-manager';
import { MockDocker } from '../mocks/docker.mock';
import type { SandboxConfig } from '../../src/core/contracts';

/**
 * Pipeline Build Command Runtime Contracts (Task 5.5.1)
 *
 * Validates the sandbox container creation contract that caused the
 * pipeline execution failures documented in the Escalation Directives.
 *
 * Root cause (Escalation Directive Round 2):
 *   Container created with zero workspace files (sandbox.ts:168-177):
 *     Cmd: ['tail', '-f', '/dev/null']
 *     Binds: cache volumes only (no source code)
 *   -> npm ci fails with ENOENT because package.json doesn't exist
 *
 * Testing Principles (ARCHITECTURE.md §8):
 *   - DI-Driven Mocking: MockDocker injects into VolumeManager
 *   - Explicit Environment: Fresh instances per test, temp isolation
 *   - State-Aware Expectations: Inspect createContainer call args
 */

describe('Pipeline Build Command Runtime Contracts (Task 5.5.1)', () => {
  let mockDocker: MockDocker;
  let volumeManager: VolumeManager;
  let sandbox: Sandbox;

  function createFixture(overrides: Partial<SandboxConfig> = {}) {
    const config: SandboxConfig = {
      project: 'test-pipeline-contract',
      baseImage: 'node:20-alpine',
      envVars: {},
      ...overrides,
    };

    mockDocker = new MockDocker();
    mockDocker.setupGetImageSuccess();
    mockDocker.setupCreateContainerSuccess();

    volumeManager = new VolumeManager(mockDocker);
    sandbox = new Sandbox(config, volumeManager);
    return { sandbox, mockDocker, config };
  }

  afterEach(async () => {
    try { await sandbox.destroy(); } catch { /* ignore */ }
  });

  // ─── §A — Container Creation Contract (Empty Workspace) ──────────────
  //
  // The sandbox container MUST start with zero workspace files.
  // Source code is provisioned by build_command (e.g. git clone).
  // This is the architectural contract documented in the escalation.

  describe('§A — Container Created With Zero Workspace Files', () => {

    it('should create container with Cmd: [tail, -f, /dev/null] (no-op entrypoint)', async () => {
      createFixture({
        cachePaths: [],
        buildCommand: 'echo build-ok',
      });

      try {
        await sandbox.init();
      } catch {
        // Catch is safe — we only inspect the createContainer call
      }

      const createCall = mockDocker.createContainerMock.mock.calls[0]?.[0];
      expect(createCall).toBeDefined();
      expect(createCall.Cmd).toEqual(['tail', '-f', '/dev/null']);
    });

    it('should bind only cache volume paths in HostConfig.Binds (no source code volumes)', async () => {
      createFixture({
        cachePaths: ['/app/node_modules', '/root/.cache/npm'],
        buildCommand: 'echo build-ok',
      });

      try {
        await sandbox.init();
      } catch {
        // safe
      }

      const createCall = mockDocker.createContainerMock.mock.calls[0]?.[0];
      expect(createCall).toBeDefined();

      const binds: string[] = createCall.HostConfig?.Binds ?? [];

      // Every bind target must be one of the configured cache paths
      for (const bind of binds) {
        const target = bind.split(':')[1];
        expect(['/app/node_modules', '/root/.cache/npm']).toContain(target);
      }

      // Number of binds must match number of cache paths
      expect(binds.length).toBe(2);
    });

    it('should create container without binds when no cache paths configured', async () => {
      createFixture({
        cachePaths: [],
        buildCommand: 'echo build-ok',
      });

      try {
        await sandbox.init();
      } catch {
        // safe
      }

      const createCall = mockDocker.createContainerMock.mock.calls[0]?.[0];
      expect(createCall).toBeDefined();
      expect(createCall.HostConfig?.Binds ?? []).toHaveLength(0);
    });

    it('should label container with app=repobench for automated cleanup', async () => {
      createFixture({
        cachePaths: [],
        buildCommand: 'echo build-ok',
      });

      try {
        await sandbox.init();
      } catch {
        // safe
      }

      const createCall = mockDocker.createContainerMock.mock.calls[0]?.[0];
      expect(createCall).toBeDefined();
      expect(createCall.Labels).toEqual(expect.objectContaining({ app: 'repobench' }));
    });

    it('should execute build_command after container creation, not as entrypoint', async () => {
      createFixture({
        cachePaths: [],
        buildCommand: 'echo provisioned-via-exec',
      });

      try {
        await sandbox.init();
      } catch {
        // safe
      }

      // Cmd must NOT contain the build_command
      const createCall = mockDocker.createContainerMock.mock.calls[0]?.[0];
      expect(createCall.Cmd).not.toContain('echo provisioned-via-exec');
      expect(createCall.Cmd).toEqual(['tail', '-f', '/dev/null']);
    });

    it('should not map the repo directory as a volume bind', async () => {
      createFixture({
        cachePaths: ['/app/cache'],
        buildCommand: 'echo build-ok',
      });

      try {
        await sandbox.init();
      } catch {
        // safe
      }

      const createCall = mockDocker.createContainerMock.mock.calls[0]?.[0];
      const binds: string[] = createCall.HostConfig?.Binds ?? [];

      // No bind should map the working directory or source code into the container
      const allTargets = binds.map(b => b.split(':')[1]);
      for (const target of allTargets) {
        expect(target).not.toBe('/workspace');
        expect(target).not.toBe('/app');
        expect(target).not.toBe('/repo');
        expect(target).not.toBe('/src');
      }
    });
  });

  // ─── §B — Build Command Executed In Empty Container ──────────────────
  //
  // The build_command runs inside the empty container via docker exec.
  // If it doesn't self-provision source code (e.g. bare npm ci),
  // the error must include actionable context.

  describe('§B — Build Command Runs In Empty Container (No Source Code)', () => {

    it('should run build_command via docker exec after container start', async () => {
      createFixture({
        cachePaths: [],
        buildCommand: 'npm ci',
      });

      // The default mock's exec returns exit 0, so init should succeed
      await sandbox.init();

      const container = sandbox.getContainer()!;
      expect(container.exec).toHaveBeenCalled();

      // The exec call must have the build_command as Cmd
      const execCalls = (container.exec as ReturnType<typeof vi.fn>).mock.calls;
      const buildExecCall = execCalls.find(([opts]: any) =>
        opts.Cmd?.includes('npm ci'),
      );
      expect(buildExecCall).toBeDefined();
    });

    it('should run build_command before agentSetupCommands', async () => {
      createFixture({
        cachePaths: [],
        buildCommand: 'echo build-step',
        agentSetupCommands: ['echo agent-setup-step'],
      });

      await sandbox.init();

      const container = sandbox.getContainer()!;
      const execCalls = (container.exec as ReturnType<typeof vi.fn>).mock.calls;
      const callCmds = execCalls.map(([opts]: any) => opts.Cmd?.join(' '));

      const buildIdx = callCmds.findIndex((c: string) => c?.includes('build-step'));
      const agentIdx = callCmds.findIndex((c: string) => c?.includes('agent-setup-step'));

      expect(buildIdx).toBeGreaterThanOrEqual(0);
      expect(agentIdx).toBeGreaterThan(buildIdx);
    });
  });

  // ─── §C — Container Config Matches Repobench Requirements ────────────

  describe('§C — Container Configuration Sanity', () => {

    it('should assign a unique container name with repobench-sandbox prefix', async () => {
      createFixture({
        cachePaths: [],
        buildCommand: 'echo ok',
        project: 'sanity-project',
      });

      await sandbox.init();

      const createCall = mockDocker.createContainerMock.mock.calls[0]?.[0];
      expect(createCall.name).toMatch(/^repobench-sandbox-/);
    });

    it('should set Image from sandbox config baseImage', async () => {
      createFixture({
        cachePaths: [],
        buildCommand: 'echo ok',
        baseImage: 'ubuntu:22.04',
      });

      await sandbox.init();

      const createCall = mockDocker.createContainerMock.mock.calls[0]?.[0];
      expect(createCall.Image).toBe('ubuntu:22.04');
    });

    it('should propagate environment variables to container Env', async () => {
      createFixture({
        cachePaths: [],
        buildCommand: 'echo ok',
        envVars: { NODE_ENV: 'test', DEBUG: '1' },
      });

      await sandbox.init();

      const createCall = mockDocker.createContainerMock.mock.calls[0]?.[0];
      expect(createCall.Env).toContain('NODE_ENV=test');
      expect(createCall.Env).toContain('DEBUG=1');
    });
  });
});
