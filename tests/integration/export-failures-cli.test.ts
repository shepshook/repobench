import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerExportFailuresCommand } from '../../src/cli/export-failures';
import { initDatabase } from '../../src/infrastructure/database';
import { FailureArtifactExporter } from '../../src/infrastructure/failure-artifact-exporter';

vi.mock('../../src/infrastructure/database');
vi.mock('../../src/core/repositories/candidate-repository');
vi.mock('../../src/core/repositories/run-result-repository');
vi.mock('../../src/infrastructure/failure-artifact-exporter');

const validUuid = '550e8400-e29b-41d4-a716-446655440000';

function createMockArtifact(overrides: Partial<{
  runId: string;
  candidateId: string;
  agentId: string;
  regressionStatus: string;
  diffPatchPath: string;
  sessionLogPath: string;
  groundTruthPath: string;
}> = {}) {
  return {
    runId: overrides.runId ?? validUuid,
    candidateId: overrides.candidateId ?? 'cand-1',
    agentId: overrides.agentId ?? 'test-agent',
    regressionStatus: overrides.regressionStatus ?? 'regressed',
    diffPatchPath: overrides.diffPatchPath ?? '/tmp/exports/run-1/diff.patch',
    sessionLogPath: overrides.sessionLogPath ?? '/tmp/exports/run-1/session.log',
    groundTruthPath: overrides.groundTruthPath ?? '/tmp/exports/run-1/ground-truth.diff',
    exportedAt: new Date(),
  };
}

describe('CLI: repobench export-failures', () => {
  let program: Command;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    registerExportFailuresCommand(program);

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
  });

  it('should export all failures when no --run-id is provided', async () => {
    const artifacts = [
      createMockArtifact({ runId: validUuid }),
      createMockArtifact({ runId: '660e8400-e29b-41d4-a716-446655440001' }),
    ];
    (FailureArtifactExporter.prototype.exportAllFailures as any).mockResolvedValue(artifacts);

    try {
      await program.parseAsync(['node', 'repobench', 'export-failures']);
    } catch (e) {
      // process.exit mock throws
    }

    expect(initDatabase).toHaveBeenCalled();
    expect(FailureArtifactExporter.prototype.exportAllFailures).toHaveBeenCalled();
    expect(FailureArtifactExporter.prototype.exportForRun).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('2'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(validUuid));
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should export a single run when --run-id is provided', async () => {
    const artifact = createMockArtifact({ runId: validUuid });
    (FailureArtifactExporter.prototype.exportForRun as any).mockResolvedValue(artifact);

    try {
      await program.parseAsync(['node', 'repobench', 'export-failures', '--run-id', validUuid]);
    } catch (e) {
      // process.exit mock throws
    }

    expect(initDatabase).toHaveBeenCalled();
    expect(FailureArtifactExporter.prototype.exportForRun).toHaveBeenCalledWith(validUuid, expect.any(Object));
    expect(FailureArtifactExporter.prototype.exportAllFailures).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(validUuid));
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should pass --output-dir to the exporter', async () => {
    const artifact = createMockArtifact({ runId: validUuid });
    (FailureArtifactExporter.prototype.exportForRun as any).mockResolvedValue(artifact);

    try {
      await program.parseAsync([
        'node', 'repobench', 'export-failures',
        '--run-id', validUuid,
        '--output-dir', 'my-exports',
      ]);
    } catch (e) {
      // process.exit mock throws
    }

    expect(FailureArtifactExporter.prototype.exportForRun).toHaveBeenCalledWith(
      validUuid,
      expect.objectContaining({ outputDir: 'my-exports' }),
    );
  });

  it('should use default output dir when --output-dir is not specified', async () => {
    const artifact = createMockArtifact({ runId: validUuid });
    (FailureArtifactExporter.prototype.exportForRun as any).mockResolvedValue(artifact);

    try {
      await program.parseAsync(['node', 'repobench', 'export-failures', '--run-id', validUuid]);
    } catch (e) {
      // process.exit mock throws
    }

    expect(FailureArtifactExporter.prototype.exportForRun).toHaveBeenCalledWith(
      validUuid,
      expect.objectContaining({ outputDir: 'exports' }),
    );
  });

  it('should log the count and diffs/session paths of exported artifacts', async () => {
    const artifact = createMockArtifact({
      runId: validUuid,
      diffPatchPath: '/tmp/exports/run-1/diff.patch',
      sessionLogPath: '/tmp/exports/run-1/session.log',
      groundTruthPath: '/tmp/exports/run-1/ground-truth.diff',
    });
    (FailureArtifactExporter.prototype.exportForRun as any).mockResolvedValue(artifact);

    try {
      await program.parseAsync(['node', 'repobench', 'export-failures', '--run-id', validUuid]);
    } catch (e) {
      // process.exit mock throws
    }

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('/tmp/exports/run-1/diff.patch'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('/tmp/exports/run-1/session.log'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('/tmp/exports/run-1/ground-truth.diff'));
  });

  it('should handle empty failures when no failed runs exist', async () => {
    (FailureArtifactExporter.prototype.exportAllFailures as any).mockResolvedValue([]);

    try {
      await program.parseAsync(['node', 'repobench', 'export-failures']);
    } catch (e) {
      // process.exit mock throws
    }

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/0\s+failed/));
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should handle errors gracefully and exit with code 1', async () => {
    (FailureArtifactExporter.prototype.exportAllFailures as any).mockRejectedValue(new Error('DB connection failed'));

    try {
      await program.parseAsync(['node', 'repobench', 'export-failures']);
    } catch (e) {
      // process.exit mock throws
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('DB connection failed'));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle missing run-id gracefully', async () => {
    (FailureArtifactExporter.prototype.exportForRun as any).mockRejectedValue(new Error('Run not found'));

    try {
      await program.parseAsync(['node', 'repobench', 'export-failures', '--run-id', validUuid]);
    } catch (e) {
      // process.exit mock throws
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Run not found'));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
