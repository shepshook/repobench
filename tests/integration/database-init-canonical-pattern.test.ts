import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

/**
 * Integration tests for Task 2.6.2 — Canonical pattern verification.
 *
 * These tests verify that ALL CLI entry points use the canonical pattern:
 *   Database.init({ dbPath: resolveDatabasePath(loadedConfig?.database?.path) })
 *
 * instead of the triple-fallback pattern:
 *   Database.init({ dbPath: loadedConfig?.database?.path ?? resolveDatabasePath() ?? 'repobench.db' })
 *
 * The key difference: the canonical pattern ALWAYS passes the config path
 * through resolveDatabasePath, while the triple-fallback short-circuits
 * when config.database.path is set (bypassing resolveDatabasePath entirely).
 *
 * Architecture principle: §8.1 Explicit Environment — isolated mocks.
 *
 * These tests are expected to FAIL until the ESCALATION DIRECTIVE fixes
 * from the spec are applied to all CLI files.
 */

// ---------------------------------------------------------------------------
// Global mocks — applied to all tests in this file
// ---------------------------------------------------------------------------

vi.mock('../../src/infrastructure/persistence/database');
vi.mock('../../src/infrastructure/database');
vi.mock('../../src/core/repositories/candidate-repository');
vi.mock('../../src/core/repositories/run-result-repository');
vi.mock('../../src/core/services/leaderboard-reporter');
vi.mock('../../src/core/services/report-renderer');
vi.mock('../../src/infrastructure/failure-artifact-exporter');
vi.mock('../../src/infrastructure/sandbox');
vi.mock('../../src/core/services/evaluator');
vi.mock('../../src/core/services/judge-service');
vi.mock('../../src/core/services/batch-runner');
vi.mock('../../src/core/services/agent-config-loader');
vi.mock('../../src/services/session-orchestrator');
vi.mock('../../src/infrastructure/services/worker-pool');
vi.mock('../../src/core/services/batch-progress-reporter');
vi.mock('../../src/core/config');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_DB_PATH = '/tmp/canonical-pattern-test/repobench.db';
const RESOLVED_DB_PATH = '/tmp/canonical-pattern-resolved/repobench.db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockExit() {
  vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit');
  });
}

function mockConsole() {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
}

async function setupConfigMock(): Promise<void> {
  const configModule = await import('../../src/core/config');
  vi.mocked(configModule.loadConfig).mockResolvedValue({
    database: { path: TEST_DB_PATH },
    mining: { keywords: [], exclude_paths: [] },
    sandbox: {} as Record<string, unknown>,
  });
  vi.mocked(configModule.resolveDatabasePath).mockReturnValue(RESOLVED_DB_PATH);
}

// ---------------------------------------------------------------------------
// evaluate command
// ---------------------------------------------------------------------------

describe('CLI: repobench evaluate — canonical pattern', () => {
  let program: Command;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockExit();
    await setupConfigMock();

    program = new Command();
    const { registerEvaluateCommand } = await import('../../src/cli/evaluate.js');
    registerEvaluateCommand(program);
  });

  it('must call resolveDatabasePath with config.database.path (not short-circuit)', async () => {
    const configModule = await import('../../src/core/config');

    try {
      await program.parseAsync(['node', 'repobench', 'evaluate']);
    } catch {
      // process.exit mock throws
    }

    expect(configModule.resolveDatabasePath).toHaveBeenCalledWith(TEST_DB_PATH);
  });

  it('must pass resolveDatabasePath result to Database.init()', async () => {
    const dbModule = await import('../../src/infrastructure/persistence/database');

    try {
      await program.parseAsync(['node', 'repobench', 'evaluate']);
    } catch {
      // process.exit mock throws
    }

    expect(dbModule.Database.init).toHaveBeenCalledWith({
      dbPath: RESOLVED_DB_PATH,
    });
  });
});

// ---------------------------------------------------------------------------
// run-all command
// ---------------------------------------------------------------------------

describe('CLI: repobench run-all — canonical pattern', () => {
  let program: Command;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockExit();
    await setupConfigMock();

    const agentConfigLoaderModule = await import('../../src/core/services/agent-config-loader');
    vi.mocked(agentConfigLoaderModule.AgentConfigLoader.prototype.loadConfigs).mockReturnValue([
      { agentId: 'aider' },
    ]);

    program = new Command();
    const { registerRunAllCommand } = await import('../../src/cli/run-all.js');
    registerRunAllCommand(program);
  });

  it('must call resolveDatabasePath with config.database.path (not short-circuit)', async () => {
    const configModule = await import('../../src/core/config');

    try {
      await program.parseAsync(['node', 'repobench', 'run-all', '--agents', 'aider']);
    } catch {
      // process.exit mock throws
    }

    expect(configModule.resolveDatabasePath).toHaveBeenCalledWith(TEST_DB_PATH);
  });

  it('must pass resolveDatabasePath result to Database.init()', async () => {
    const dbModule = await import('../../src/infrastructure/persistence/database');

    try {
      await program.parseAsync(['node', 'repobench', 'run-all', '--agents', 'aider']);
    } catch {
      // process.exit mock throws
    }

    expect(dbModule.Database.init).toHaveBeenCalledWith({
      dbPath: RESOLVED_DB_PATH,
    });
  });
});

// ---------------------------------------------------------------------------
// report command
// ---------------------------------------------------------------------------

describe('CLI: repobench report — canonical pattern', () => {
  let program: Command;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockConsole();
    mockExit();
    await setupConfigMock();

    program = new Command();
    const { registerReportCommand } = await import('../../src/cli/report.js');
    registerReportCommand(program);
  });

  it('must call resolveDatabasePath with config.database.path (not short-circuit)', async () => {
    const configModule = await import('../../src/core/config');

    try {
      await program.parseAsync(['node', 'repobench', 'report']);
    } catch {
      // process.exit mock throws
    }

    expect(configModule.resolveDatabasePath).toHaveBeenCalledWith(TEST_DB_PATH);
  });

  it('must pass resolveDatabasePath result to Database.init()', async () => {
    const dbModule = await import('../../src/infrastructure/persistence/database');

    try {
      await program.parseAsync(['node', 'repobench', 'report']);
    } catch {
      // process.exit mock throws
    }

    expect(dbModule.Database.init).toHaveBeenCalledWith({
      dbPath: RESOLVED_DB_PATH,
    });
  });
});

// ---------------------------------------------------------------------------
// export-failures command
// ---------------------------------------------------------------------------

describe('CLI: repobench export-failures — canonical pattern', () => {
  let program: Command;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockExit();
    await setupConfigMock();

    program = new Command();
    const { registerExportFailuresCommand } = await import('../../src/cli/export-failures.js');
    registerExportFailuresCommand(program);
  });

  it('must call resolveDatabasePath with config.database.path (not short-circuit)', async () => {
    const configModule = await import('../../src/core/config');

    try {
      await program.parseAsync(['node', 'repobench', 'export-failures']);
    } catch {
      // process.exit mock throws
    }

    expect(configModule.resolveDatabasePath).toHaveBeenCalledWith(TEST_DB_PATH);
  });

  it('must pass resolveDatabasePath result to Database.init()', async () => {
    const dbModule = await import('../../src/infrastructure/persistence/database');

    try {
      await program.parseAsync(['node', 'repobench', 'export-failures']);
    } catch {
      // process.exit mock throws
    }

    expect(dbModule.Database.init).toHaveBeenCalledWith({
      dbPath: RESOLVED_DB_PATH,
    });
  });
});
