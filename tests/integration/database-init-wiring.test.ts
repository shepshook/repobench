import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

/**
 * Integration tests for Task 2.6.2 — Database initialization wiring.
 *
 * These tests verify that ALL CLI entry points use Database.init({ dbPath })
 * instead of the legacy initDatabase function (now removed).
 * Architecture directive: All CLI entry points must wire
 * config.database.path -> Database.init() via resolveDatabasePath().
 *
 * Architecture principle: §8.1 Explicit Environment — each test uses
 * isolated mocks with no filesystem side effects.
 *
 * All vi.mock() calls are at the top level per vitest requirements.
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
vi.mock('../../src/core/services/miner');
vi.mock('../../src/core/config');

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

// ---------------------------------------------------------------------------
// report command — now uses Database.init with config-driven path
// Expected: Database.init({ dbPath: config.database.path })
// ---------------------------------------------------------------------------

describe('CLI: repobench report — database wiring', () => {
  let program: Command;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockConsole();
    mockExit();

    const configModule = await import('../../src/core/config');
    vi.mocked(configModule.loadConfig).mockResolvedValue({
      database: { path: '/tmp/report-test/repobench.db' },
      mining: { keywords: [], exclude_paths: [] },
    });
    vi.mocked(configModule.resolveDatabasePath).mockReturnValue('/tmp/report-test/resolved.db');

    program = new Command();
    const { registerReportCommand } = await import('../../src/cli/report.js');
    registerReportCommand(program);
  });

  it('must call Database.init()', async () => {
    const dbModule = await import('../../src/infrastructure/persistence/database');

    try {
      await program.parseAsync(['node', 'repobench', 'report']);
    } catch {
      // process.exit mock throws
    }

    expect(dbModule.Database.init).toHaveBeenCalled();
  });

  it('must pass dbPath to Database.init()', async () => {
    const dbModule = await import('../../src/infrastructure/persistence/database');

    try {
      await program.parseAsync(['node', 'repobench', 'report']);
    } catch {
      // process.exit mock throws
    }

    expect(dbModule.Database.init).toHaveBeenCalledWith({ dbPath: expect.any(String) });
  });
});

// ---------------------------------------------------------------------------
// mine command — canonical reference (already passes review)
// Uses Database.init({ dbPath: resolveDatabasePath(config.database?.path) })
// ---------------------------------------------------------------------------

describe('CLI: repobench mine — database wiring', () => {
  let program: Command;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockConsole();
    mockExit();

    const configModule = await import('../../src/core/config');
    vi.mocked(configModule.loadConfig).mockResolvedValue({
      database: { path: '/tmp/mine/repobench.db' },
      mining: { keywords: [], exclude_paths: [] },
    });
    vi.mocked(configModule.resolveDatabasePath).mockReturnValue('/tmp/mine/resolved.db');

    program = new Command();
    const { registerMineCommand } = await import('../../src/cli/mine.js');
    registerMineCommand(program);
  });

  it('must call Database.init()', async () => {
    const dbModule = await import('../../src/infrastructure/persistence/database');

    try {
      await program.parseAsync(['node', 'repobench', 'mine']);
    } catch {
      // process.exit mock throws
    }

    expect(dbModule.Database.init).toHaveBeenCalled();
  });

  it('must pass resolveDatabasePath result to Database.init()', async () => {
    const dbModule = await import('../../src/infrastructure/persistence/database');

    try {
      await program.parseAsync(['node', 'repobench', 'mine']);
    } catch {
      // process.exit mock throws
    }

    expect(dbModule.Database.init).toHaveBeenCalledWith({
      dbPath: '/tmp/mine/resolved.db',
    });
  });

  it('should call resolveDatabasePath with config.database.path', async () => {
    const configModule = await import('../../src/core/config');

    try {
      await program.parseAsync(['node', 'repobench', 'mine']);
    } catch {
      // process.exit mock throws
    }

    expect(configModule.resolveDatabasePath).toHaveBeenCalledWith('/tmp/mine/repobench.db');
  });
});

// ---------------------------------------------------------------------------
// export-failures command — now uses Database.init with config-driven path
// Expected: Database.init({ dbPath: config.database.path })
// ---------------------------------------------------------------------------

describe('CLI: repobench export-failures — database wiring', () => {
  let program: Command;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockConsole();
    mockExit();

    const configModule = await import('../../src/core/config');
    vi.mocked(configModule.loadConfig).mockResolvedValue({
      database: { path: '/tmp/export-failures-test/repobench.db' },
      mining: { keywords: [], exclude_paths: [] },
    });
    vi.mocked(configModule.resolveDatabasePath).mockReturnValue('/tmp/export-failures-test/resolved.db');

    program = new Command();
    const { registerExportFailuresCommand } = await import('../../src/cli/export-failures.js');
    registerExportFailuresCommand(program);
  });

  it('must call Database.init()', async () => {
    const dbModule = await import('../../src/infrastructure/persistence/database');

    try {
      await program.parseAsync(['node', 'repobench', 'export-failures']);
    } catch {
      // process.exit mock throws
    }

    expect(dbModule.Database.init).toHaveBeenCalled();
  });

  it('must pass dbPath to Database.init()', async () => {
    const dbModule = await import('../../src/infrastructure/persistence/database');

    try {
      await program.parseAsync(['node', 'repobench', 'export-failures']);
    } catch {
      // process.exit mock throws
    }

    expect(dbModule.Database.init).toHaveBeenCalledWith({ dbPath: expect.any(String) });
  });
});

// ---------------------------------------------------------------------------
// evaluate command — now uses Database.init with config-driven path
// Expected: Database.init({ dbPath: config.database.path })
// ---------------------------------------------------------------------------

describe('CLI: repobench evaluate — database wiring', () => {
  let program: Command;

  beforeEach(async () => {
    vi.clearAllMocks();
    const configModule = await import('../../src/core/config');
    vi.mocked(configModule.loadConfig).mockResolvedValue({
      database: { path: '/tmp/evaluate-test/repobench.db' },
      sandbox: {},
    });
    vi.mocked(configModule.resolveDatabasePath).mockReturnValue('/tmp/evaluate-test/resolved.db');
    mockExit();

    program = new Command();
    const { registerEvaluateCommand } = await import('../../src/cli/evaluate.js');
    registerEvaluateCommand(program);
  });

  it('must call Database.init()', async () => {
    const dbModule = await import('../../src/infrastructure/persistence/database');

    try {
      await program.parseAsync(['node', 'repobench', 'evaluate']);
    } catch {
      // process.exit mock throws
    }

    expect(dbModule.Database.init).toHaveBeenCalled();
  });

  it('must pass resolveDatabasePath result to Database.init()', async () => {
    const dbModule = await import('../../src/infrastructure/persistence/database');

    try {
      await program.parseAsync(['node', 'repobench', 'evaluate']);
    } catch {
      // process.exit mock throws
    }

    expect(dbModule.Database.init).toHaveBeenCalledWith({
      dbPath: '/tmp/evaluate-test/resolved.db',
    });
  });
});

// ---------------------------------------------------------------------------
// run-all command — now uses Database.init with config-driven path
// Expected: Database.init({ dbPath: config.database.path })
// ---------------------------------------------------------------------------

describe('CLI: repobench run-all — database wiring', () => {
  let program: Command;

  beforeEach(async () => {
    vi.clearAllMocks();
    const configModule = await import('../../src/core/config');
    vi.mocked(configModule.loadConfig).mockResolvedValue({
      database: { path: '/tmp/runall-test/repobench.db' },
      sandbox: {},
    });
    vi.mocked(configModule.resolveDatabasePath).mockReturnValue('/tmp/runall-test/resolved.db');
    const agentConfigLoaderModule = await import('../../src/core/services/agent-config-loader');
    vi.mocked(agentConfigLoaderModule.AgentConfigLoader.prototype.loadConfigs).mockReturnValue([{ agentId: 'aider' }]);
    mockExit();

    program = new Command();
    const { registerRunAllCommand } = await import('../../src/cli/run-all.js');
    registerRunAllCommand(program);
  });

  it('must call Database.init()', async () => {
    const dbModule = await import('../../src/infrastructure/persistence/database');

    try {
      await program.parseAsync(['node', 'repobench', 'run-all', '--agents', 'aider']);
    } catch {
      // process.exit mock throws
    }

    expect(dbModule.Database.init).toHaveBeenCalled();
  });

  it('must pass resolveDatabasePath result to Database.init()', async () => {
    const dbModule = await import('../../src/infrastructure/persistence/database');

    try {
      await program.parseAsync(['node', 'repobench', 'run-all', '--agents', 'aider']);
    } catch {
      // process.exit mock throws
    }

    expect(dbModule.Database.init).toHaveBeenCalledWith({
      dbPath: '/tmp/runall-test/resolved.db',
    });
  });
});
