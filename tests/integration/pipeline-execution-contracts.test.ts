import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/core/config';
import path from 'node:path';

/**
 * Pipeline Execution Contracts (Task 5.5.1)
 *
 * These tests validate that the repobench.yaml config and CLI entry point
 * satisfy the sandbox and pipeline execution contracts identified during
 * escalation rounds. Known failures are documented in the spec.
 *
 * Testing Principles (ARCHITECTURE.md §8):
 * - Explicit Environment via real config loading
 * - No "Hope-based" Testing — precise assertions on known issues
 * - Strict Isolation — no shared state
 */

const REPOBENCH_REPO = path.resolve(process.cwd());
const CONFIG_PATH = path.join(REPOBENCH_REPO, 'repobench.yaml');

describe('Pipeline Execution Contracts (Task 5.5.1)', () => {

  describe('§A — Sandbox build_command must self-provision workspace source code', () => {
    /**
     * Root Cause (Escalation Directive R2):
     *   build_command: "npm ci"  ← fails because Docker container starts empty
     *   (sandbox.ts:168-177 — Cmd: ['tail', '-f', '/dev/null'], only cache volumes bound).
     *   npm ci fails with ENOENT because package.json doesn't exist inside the container.
     *
     * Fix:
     *   build_command: "git clone https://github.com/anomalyco/repobench.git /workspace && cd /workspace && git checkout $(git rev-parse HEAD) && npm ci"
     *
     * Documented pattern: tests/infrastructure/sandbox-state.test.ts:11 uses:
     *   buildCommand: 'git clone https://github.com/anomalyco/repobench.git /app && cd /app'
     */

    it('must include a git clone step to provision source code in the empty sandbox container', async () => {
      const config = await loadConfig(CONFIG_PATH);
      const buildCommand = config.sandbox?.buildCommand ?? '';

      expect(buildCommand).toMatch(/git clone/);
    });

    it('must clone the repobench repository (anomalyco/repobench) for the dogfooding use case', async () => {
      const config = await loadConfig(CONFIG_PATH);
      const buildCommand = config.sandbox?.buildCommand ?? '';

      expect(buildCommand).toContain('github.com/anomalyco/repobench');
    });

    it('must cd into the cloned directory before running npm ci', async () => {
      const config = await loadConfig(CONFIG_PATH);
      const buildCommand = config.sandbox?.buildCommand ?? '';

      const commands = buildCommand.split('&&').map(s => s.trim());
      const hasCd = commands.some(cmd => cmd.startsWith('cd '));
      const hasNpmCi = commands.some(cmd => cmd === 'npm ci');

      expect(hasCd && hasNpmCi).toBe(true);
    });

    it('must git checkout HEAD after clone to ensure the sandbox starts on the current commit', async () => {
      const config = await loadConfig(CONFIG_PATH);
      const buildCommand = config.sandbox?.buildCommand ?? '';

      expect(buildCommand).toMatch(/git checkout/);
    });

    it('must NOT be a bare "npm ci" with no provisioning step', async () => {
      const config = await loadConfig(CONFIG_PATH);
      const buildCommand = config.sandbox?.buildCommand ?? '';

      const hasProvisioning = /git clone|wget|curl|COPY|ADD|apt-get|apk add/.test(buildCommand);
      expect(hasProvisioning).toBe(true);
    });
  });

  describe('§B — CLI entry point must support npx tsx invocation (no compiled JS output)', () => {
    /**
     * Spec Bug (Escalation Directive):
     *   Steps 1-5 reference `node src/cli/index.js` — no compiled JS output exists.
     *   Use `npx tsx src/cli/index.ts` instead.
     */

    it('must NOT have a compiled index.js in src/cli/ (only .ts entry point exists)', async () => {
      const fs = await import('node:fs');
      const jsPath = path.resolve('src/cli/index.js');
      const tsPath = path.resolve('src/cli/index.ts');

      expect(fs.existsSync(jsPath)).toBe(false);
      expect(fs.existsSync(tsPath)).toBe(true);
    });

    it('should list all 6 pipeline commands when --help is invoked via npx tsx', async () => {
      const { execSync } = await import('node:child_process');

      const stdout = execSync(
        `npx tsx src/cli/index.ts --help`,
        { cwd: REPOBENCH_REPO, encoding: 'utf8', timeout: 30000 },
      );

      expect(stdout).toContain('mine');
      expect(stdout).toContain('benchmark');
      expect(stdout).toContain('evaluate');
      expect(stdout).toContain('run-all');
      expect(stdout).toContain('report');
      expect(stdout).toContain('export-failures');
    });
  });

  describe('§C — Pipeline must detect candidates via npx tsx entry point (AC #1)', () => {
    /**
     * Acceptance Criteria #1:
     *   mine command runs successfully and discovers candidates.
     *   The escalation confirms `npx tsx src/cli/index.ts mine -r .` finds 7 candidates.
     */

    it('should discover at least 1 candidate when mining RepoBench repo via npx tsx entry point', async () => {
      const { execSync } = await import('node:child_process');
      const fs = await import('node:fs/promises');
      const os = await import('node:os');
      const cliEntry = path.resolve('src/cli/index.ts');

      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pipeline-exec-mine-'));
      try {
        const stdout = execSync(
          `npx tsx "${cliEntry}" mine -r "${REPOBENCH_REPO}"`,
          { cwd: tmpDir, encoding: 'utf8', timeout: 60000 },
        );

        expect(stdout).toMatch(/Found (\d+) candidates\./);
        const match = stdout.match(/Found (\d+) candidates\./);
        expect(match).not.toBeNull();
        const count = parseInt(match![1], 10);
        expect(count).toBeGreaterThanOrEqual(1);
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    }, 120000);
  });

  describe('§D — Pipeline config must satisfy sandbox integration contract', () => {
    /**
     * Pre-Flight Checklist (§7.4 item 3):
     *   Agent dependencies (agentSetupCommands) must be installable inside
     *   the sandbox container. The repobench.yaml must define them.
     */

    it('must define agent_setup_commands for installing agent dependencies in sandbox', async () => {
      const config = await loadConfig(CONFIG_PATH);

      expect(config.sandbox).toBeDefined();
      expect(config.sandbox!.agentSetupCommands).toBeDefined();
      expect(Array.isArray(config.sandbox!.agentSetupCommands)).toBe(true);
      expect(config.sandbox!.agentSetupCommands!.length).toBeGreaterThan(0);
    });

    it('must install opencode in agent_setup_commands for the dogfooding pipeline', async () => {
      const config = await loadConfig(CONFIG_PATH);

      const setupCmds = config.sandbox!.agentSetupCommands ?? [];
      const hasOpencodeInstall = setupCmds.some(
        cmd => cmd.includes('opencode') || cmd.includes('open code'),
      );
      expect(hasOpencodeInstall).toBe(true);
    });

    it('must define test_command for regression verification', async () => {
      const config = await loadConfig(CONFIG_PATH);

      expect(config.sandbox).toBeDefined();
      expect(config.sandbox!.testCommand).toBeDefined();
      expect(config.sandbox!.testCommand!.length).toBeGreaterThan(0);
    });

    it('must define base_image for Docker container creation', async () => {
      const config = await loadConfig(CONFIG_PATH);

      expect(config.sandbox).toBeDefined();
      expect(config.sandbox!.baseImage).toBeDefined();
      expect(config.sandbox!.baseImage!.length).toBeGreaterThan(0);
    });
  });
});
