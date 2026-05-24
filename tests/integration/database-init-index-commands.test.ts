import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Integration tests for Task 2.6.2 — Database init via index.ts
 * export/import commands.
 *
 * These tests verify that the `export` and `import` commands defined
 * directly in src/cli/index.ts use the canonical pattern:
 *   Database.init({ dbPath: resolveDatabasePath(config?.database?.path) })
 *
 * Architecture principle: §8.1 Explicit Environment — isolated mocks.
 */

vi.mock('../../src/infrastructure/persistence/database');
vi.mock('../../src/infrastructure/database');
vi.mock('../../src/core/config');
vi.mock('../../src/core/repositories/candidate-repository');
vi.mock('../../src/core/repositories/run-result-repository');
vi.mock('../../src/infrastructure/jsonl-dataset-exporter');
vi.mock('../../src/infrastructure/jsonl-dataset-importer');
vi.mock('../../src/cli/evaluate');
vi.mock('../../src/cli/run-all');
vi.mock('../../src/cli/report');
vi.mock('../../src/cli/export-failures');
vi.mock('../../src/cli/mine');
vi.mock('../../src/cli/benchmark');
vi.mock('../../src/infrastructure/agents/register-adapters');

const TEST_DB_PATH = '/tmp/index-test/repobench.db';
const RESOLVED_DB_PATH = '/tmp/index-resolved/repobench.db';

async function setupConfig() {
  const configModule = await import('../../src/core/config');
  vi.mocked(configModule.loadConfig).mockResolvedValue({
    database: { path: TEST_DB_PATH },
    mining: { keywords: [], exclude_paths: [] },
  });
  vi.mocked(configModule.resolveDatabasePath).mockReturnValue(RESOLVED_DB_PATH);
}

function mockExitAndLog() {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit');
  });
}

describe('CLI: repobench export — database init wiring via index.ts', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mockExitAndLog();
    await setupConfig();
  });

  it('must call Database.init with resolveDatabasePath result and invoke resolveDatabasePath with config.database.path', async () => {
    const origArgv = process.argv;
    process.argv = ['node', 'repobench', 'export', '/tmp/out.jsonl'];

    try {
      await import('../../src/cli/index');
    } catch {
      // process.exit mock throws
    }

    const dbModule = await import('../../src/infrastructure/persistence/database');
    const configModule = await import('../../src/core/config');

    expect(dbModule.Database.init).toHaveBeenCalledWith({
      dbPath: RESOLVED_DB_PATH,
    });
    expect(configModule.resolveDatabasePath).toHaveBeenCalledWith(TEST_DB_PATH);

    process.argv = origArgv;
  });
});

describe('CLI: repobench import — database init wiring via index.ts', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mockExitAndLog();
    await setupConfig();
  });

  it('must call Database.init with resolveDatabasePath result and invoke resolveDatabasePath with config.database.path', async () => {
    const origArgv = process.argv;
    process.argv = ['node', 'repobench', 'import', '/tmp/in.jsonl'];

    try {
      await import('../../src/cli/index');
    } catch {
      // process.exit mock throws
    }

    const dbModule = await import('../../src/infrastructure/persistence/database');
    const configModule = await import('../../src/core/config');

    expect(dbModule.Database.init).toHaveBeenCalledWith({
      dbPath: RESOLVED_DB_PATH,
    });
    expect(configModule.resolveDatabasePath).toHaveBeenCalledWith(TEST_DB_PATH);

    process.argv = origArgv;
  });
});
