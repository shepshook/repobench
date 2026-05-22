import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  FailureArtifactSchema,
  FailureArtifactExporterOptions,
  IFailureArtifactExporter,
  type FailureArtifact,
} from '../../src/core/contracts';

const validUuid = () => crypto.randomUUID();

describe('FailureArtifactSchema', () => {
  it('should be defined as a zod schema', () => {
    expect(FailureArtifactSchema).toBeDefined();
    expect(typeof FailureArtifactSchema.parse).toBe('function');
  });

  it('should validate a correct FailureArtifact object', () => {
    const artifact = {
      runId: validUuid(),
      candidateId: validUuid(),
      agentId: 'agent-1',
      regressionStatus: 'regressed',
      diffPatchPath: '/exports/run-1/diff.patch',
      sessionLogPath: '/exports/run-1/session.log',
      groundTruthPath: '/exports/run-1/ground-truth.diff',
      exportedAt: new Date(),
    };
    expect(() => FailureArtifactSchema.parse(artifact)).not.toThrow();
  });

  it('should accept all valid regressionStatus values', () => {
    for (const status of ['regressed', 'error'] as const) {
      const artifact = {
        runId: validUuid(),
        candidateId: validUuid(),
        agentId: 'agent-1',
        regressionStatus: status,
        diffPatchPath: '/exports/diff.patch',
        sessionLogPath: '/exports/session.log',
        groundTruthPath: '/exports/ground-truth.diff',
        exportedAt: new Date(),
      };
      expect(() => FailureArtifactSchema.parse(artifact)).not.toThrow();
    }
  });

  it('should throw for invalid regressionStatus', () => {
    const artifact = {
      runId: validUuid(),
      candidateId: validUuid(),
      agentId: 'agent-1',
      regressionStatus: 'invalid-status',
      diffPatchPath: '/exports/diff.patch',
      sessionLogPath: '/exports/session.log',
      groundTruthPath: '/exports/ground-truth.diff',
      exportedAt: new Date(),
    };
    // @ts-expect-error - testing runtime validation
    expect(() => FailureArtifactSchema.parse(artifact)).toThrow();
  });

  it('should reject clean regressionStatus after schema removal', () => {
    // Regression test for Task 5.FIX1.1: 'clean' was removed from the enum
    // because FailureArtifact is only produced for failed runs.
    const artifact = {
      runId: validUuid(),
      candidateId: validUuid(),
      agentId: 'agent-1',
      regressionStatus: 'clean',
      diffPatchPath: '/exports/diff.patch',
      sessionLogPath: '/exports/session.log',
      groundTruthPath: '/exports/ground-truth.diff',
      exportedAt: new Date(),
    };
    // @ts-expect-error - 'clean' is no longer a valid regressionStatus
    expect(() => FailureArtifactSchema.parse(artifact)).toThrow();
  });

  it('should throw for invalid runId (not a UUID)', () => {
    const artifact = {
      runId: 'not-a-uuid',
      candidateId: validUuid(),
      agentId: 'agent-1',
      regressionStatus: 'clean',
      diffPatchPath: '/exports/diff.patch',
      sessionLogPath: '/exports/session.log',
      groundTruthPath: '/exports/ground-truth.diff',
      exportedAt: new Date(),
    };
    // @ts-expect-error - testing runtime validation
    expect(() => FailureArtifactSchema.parse(artifact)).toThrow();
  });

  it('should throw for invalid candidateId (not a UUID)', () => {
    const artifact = {
      runId: validUuid(),
      candidateId: 'not-a-uuid',
      agentId: 'agent-1',
      regressionStatus: 'clean',
      diffPatchPath: '/exports/diff.patch',
      sessionLogPath: '/exports/session.log',
      groundTruthPath: '/exports/ground-truth.diff',
      exportedAt: new Date(),
    };
    // @ts-expect-error - testing runtime validation
    expect(() => FailureArtifactSchema.parse(artifact)).toThrow();
  });

  it('should throw for missing required fields', () => {
    const artifact = {
      runId: validUuid(),
      candidateId: validUuid(),
      // missing agentId, regressionStatus, paths, exportedAt
    };
    // @ts-expect-error - testing runtime validation
    expect(() => FailureArtifactSchema.parse(artifact)).toThrow();
  });

  it('should throw for wrong type on exportedAt', () => {
    const artifact = {
      runId: validUuid(),
      candidateId: validUuid(),
      agentId: 'agent-1',
      regressionStatus: 'clean',
      diffPatchPath: '/exports/diff.patch',
      sessionLogPath: '/exports/session.log',
      groundTruthPath: '/exports/ground-truth.diff',
      exportedAt: '2024-01-01T00:00:00Z',
    };
    // @ts-expect-error - testing runtime validation
    expect(() => FailureArtifactSchema.parse(artifact)).toThrow();
  });
});

describe('FailureArtifactExporterOptions', () => {
  it('should apply default outputDir when not provided', () => {
    const opts = FailureArtifactExporterOptions.parse({
      runId: validUuid(),
    });
    expect(opts.outputDir).toBe('exports');
    expect(opts.runId).toBeDefined();
  });

  it('should accept explicit outputDir value', () => {
    const opts = FailureArtifactExporterOptions.parse({
      outputDir: 'custom-exports',
      runId: validUuid(),
    });
    expect(opts.outputDir).toBe('custom-exports');
  });

  it('should throw for invalid runId', () => {
    // @ts-expect-error - testing runtime validation
    expect(() => FailureArtifactExporterOptions.parse({ runId: 'bad' })).toThrow();
  });

  it('should throw when runId is missing', () => {
    // @ts-expect-error - testing runtime validation
    expect(() => FailureArtifactExporterOptions.parse({})).toThrow();
  });
});

describe('IFailureArtifactExporter', () => {
  it('should be implementable by a mock class', () => {
    class MockFailureExporter implements IFailureArtifactExporter {
      async exportForRun(runId: string, options?: { outputDir?: string }): Promise<FailureArtifact> {
        return {
          runId: validUuid(),
          candidateId: validUuid(),
          agentId: 'test-agent',
          regressionStatus: 'regressed',
          diffPatchPath: `${options?.outputDir ?? 'exports'}/${runId}/diff.patch`,
          sessionLogPath: `${options?.outputDir ?? 'exports'}/${runId}/session.log`,
          groundTruthPath: `${options?.outputDir ?? 'exports'}/${runId}/ground-truth.diff`,
          exportedAt: new Date(),
        };
      }

      async exportAllFailures(options?: { outputDir?: string }): Promise<FailureArtifact[]> {
        return [];
      }
    }

    const exporter: IFailureArtifactExporter = new MockFailureExporter();
    expect(exporter).toBeDefined();
  });

  it('should export a single run via exportForRun', async () => {
    class MockFailureExporter implements IFailureArtifactExporter {
      async exportForRun(runId: string): Promise<FailureArtifact> {
        return {
          runId,
          candidateId: validUuid(),
          agentId: 'agent-alpha',
          regressionStatus: 'regressed',
          diffPatchPath: `exports/${runId}/diff.patch`,
          sessionLogPath: `exports/${runId}/session.log`,
          groundTruthPath: `exports/${runId}/ground-truth.diff`,
          exportedAt: new Date(),
        };
      }

      async exportAllFailures(): Promise<FailureArtifact[]> {
        return [];
      }
    }

    const exporter = new MockFailureExporter();
    const runId = validUuid();
    const result = await exporter.exportForRun(runId);
    expect(result.runId).toBe(runId);
    expect(result.regressionStatus).toBe('regressed');
    expect(result.diffPatchPath).toContain(runId);
  });

  it('should return an array from exportAllFailures', async () => {
    class MockFailureExporter implements IFailureArtifactExporter {
      async exportForRun(runId: string): Promise<FailureArtifact> {
        throw new Error('not used');
      }

      async exportAllFailures(): Promise<FailureArtifact[]> {
        return [
          {
            runId: validUuid(),
            candidateId: validUuid(),
            agentId: 'agent-alpha',
            regressionStatus: 'regressed',
            diffPatchPath: 'exports/run-1/diff.patch',
            sessionLogPath: 'exports/run-1/session.log',
            groundTruthPath: 'exports/run-1/ground-truth.diff',
            exportedAt: new Date(),
          },
        ];
      }
    }

    const exporter = new MockFailureExporter();
    const results = await exporter.exportAllFailures();
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(1);
    expect(results[0].regressionStatus).toBe('regressed');
  });

  it('should accept optional outputDir in exportForRun', async () => {
    class MockFailureExporter implements IFailureArtifactExporter {
      async exportForRun(runId: string, options?: { outputDir?: string }): Promise<FailureArtifact> {
        return {
          runId,
          candidateId: validUuid(),
          agentId: 'agent-alpha',
          regressionStatus: 'error',
          diffPatchPath: `${options?.outputDir ?? 'default'}/${runId}/diff.patch`,
          sessionLogPath: `${options?.outputDir ?? 'default'}/${runId}/session.log`,
          groundTruthPath: `${options?.outputDir ?? 'default'}/${runId}/ground-truth.diff`,
          exportedAt: new Date(),
        };
      }

      async exportAllFailures(options?: { outputDir?: string }): Promise<FailureArtifact[]> {
        return [];
      }
    }

    const exporter = new MockFailureExporter();
    const runId = validUuid();
    const result = await exporter.exportForRun(runId, { outputDir: 'custom' });
    expect(result.diffPatchPath).toBe(`custom/${runId}/diff.patch`);
  });

  it('should accept optional outputDir in exportAllFailures', async () => {
    class MockFailureExporter implements IFailureArtifactExporter {
      async exportForRun(): Promise<FailureArtifact> {
        throw new Error('not used');
      }

      async exportAllFailures(options?: { outputDir?: string }): Promise<FailureArtifact[]> {
        return [
          {
            runId: validUuid(),
            candidateId: validUuid(),
            agentId: 'agent-alpha',
            regressionStatus: 'error',
            diffPatchPath: `${options?.outputDir ?? 'exports'}/run-1/diff.patch`,
            sessionLogPath: `${options?.outputDir ?? 'exports'}/run-1/session.log`,
            groundTruthPath: `${options?.outputDir ?? 'exports'}/run-1/ground-truth.diff`,
            exportedAt: new Date(),
          },
        ];
      }
    }

    const exporter = new MockFailureExporter();
    const results = await exporter.exportAllFailures({ outputDir: 'custom' });
    expect(results[0].diffPatchPath).toContain('custom/');
  });
});
