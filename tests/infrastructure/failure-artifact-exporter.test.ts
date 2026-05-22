import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import type {
  IRunResultRepository,
  ICandidateRepository,
  ISandbox,
  IFailureArtifactExporter,
  RunResult,
  Candidate,
  FailureArtifact,
} from '../../src/core/contracts';

const validUuid = () => crypto.randomUUID();

function createMockRunResult(overrides: Partial<RunResult> = {}): RunResult {
  return {
    runId: validUuid(),
    agentId: 'test-agent',
    candidateId: validUuid(),
    metrics: {
      success: false,
      cost: 0.05,
      latency: 1200,
      eScore: 0.15,
      ...(overrides.metrics ?? {}),
    },
    timestamp: new Date(),
    ...overrides,
  };
}

function createMockCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: validUuid(),
    hash: 'abc123def456abc123def456abc123def456abc1',
    message: 'Fix bug',
    files: ['src/main.ts'],
    status: 'curated',
    created_at: new Date(),
    repositoryUrl: 'https://github.com/test/repo.git',
    repositoryName: 'test/repo',
    preFixHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    postFixHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    ...overrides,
  };
}

function createMockRunResultRepo(results: RunResult[] = []): IRunResultRepository {
  const store = new Map<string, RunResult>();
  for (const r of results) store.set(r.runId, r);

  return {
    save: vi.fn(),
    getById: vi.fn((runId: string) => store.get(runId)),
    getAll: vi.fn(() => Array.from(store.values())),
    getByAgentId: vi.fn(),
    getByCandidateId: vi.fn(),
  };
}

function createMockCandidateRepo(candidates: Candidate[] = []): ICandidateRepository {
  const store = new Map<string, Candidate>();
  for (const c of candidates) store.set(c.id, c);

  return {
    save: vi.fn(),
    upsert: vi.fn(),
    exists: vi.fn(),
    existsById: vi.fn(),
    getById: vi.fn((id: string) => store.get(id)),
    getAll: vi.fn(() => Array.from(store.values())),
  };
}

function createMockSandbox(overrides: Partial<ISandbox> = {}): ISandbox {
  return {
    id: 'mock-sandbox',
    config: {},
    init: vi.fn(),
    destroy: vi.fn(),
    execute: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
    runCommand: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
    switchState: vi.fn().mockResolvedValue(undefined),
    createSnapshot: vi.fn(),
    restoreSnapshot: vi.fn(),
    getFilesystemSnapshot: vi.fn(),
    getCacheStats: vi.fn(),
    ping: vi.fn(),
    getFileAccessTracker: vi.fn(),
    ...overrides,
  };
}

describe('FailureArtifactExporter', () => {
  let tmpDir: string;
  let runResultRepo: IRunResultRepository;
  let candidateRepo: ICandidateRepository;
  let sandbox: ISandbox;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'failure-exporter-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('exportForRun', () => {
    it('should skip successful runs', async () => {
      const run = createMockRunResult({
        runId: validUuid(),
        metrics: { success: true, cost: 0.05, latency: 100, eScore: 1 },
      });
      runResultRepo = createMockRunResultRepo([run]);
      candidateRepo = createMockCandidateRepo();
      sandbox = createMockSandbox();

      const { FailureArtifactExporter } = await import('../../src/infrastructure/failure-artifact-exporter');
      const exporter = new FailureArtifactExporter(runResultRepo, candidateRepo, sandbox);

      await expect(exporter.exportForRun(run.runId, { outputDir: tmpDir })).rejects.toThrow();
    });

    it('should create all three artifact files for a failed run with sandbox', async () => {
      const candidate = createMockCandidate();
      const run = createMockRunResult({
        runId: validUuid(),
        candidateId: candidate.id,
      });

      const diffOutput = '--- a/src/main.ts\n+++ b/src/main.ts\n@@ -1 +1 @@\n-old code\n+new code\n';
      sandbox = createMockSandbox({
        execute: vi.fn().mockResolvedValue({ stdout: diffOutput, stderr: '', exitCode: 0 }),
        switchState: vi.fn().mockResolvedValue(undefined),
        runCommand: vi.fn().mockResolvedValue({ stdout: diffOutput, stderr: '', exitCode: 0 }),
      });

      runResultRepo = createMockRunResultRepo([run]);
      candidateRepo = createMockCandidateRepo([candidate]);

      const { FailureArtifactExporter } = await import('../../src/infrastructure/failure-artifact-exporter');
      const exporter = new FailureArtifactExporter(runResultRepo, candidateRepo, sandbox);

      const artifact = await exporter.exportForRun(run.runId, { outputDir: tmpDir });

      expect(artifact.runId).toBe(run.runId);
      expect(artifact.candidateId).toBe(candidate.id);
      expect(artifact.agentId).toBe(run.agentId);

      const diffPath = path.join(tmpDir, run.runId, 'diff.patch');
      const sessionLogPath = path.join(tmpDir, run.runId, 'session.log');
      const groundTruthPath = path.join(tmpDir, run.runId, 'ground-truth.diff');

      expect(artifact.diffPatchPath).toBe(diffPath);
      expect(artifact.sessionLogPath).toBe(sessionLogPath);
      expect(artifact.groundTruthPath).toBe(groundTruthPath);

      const diffContent = await fs.readFile(diffPath, 'utf8');
      expect(diffContent).toBe(diffOutput);

      const groundTruthContent = await fs.readFile(groundTruthPath, 'utf8');
      expect(groundTruthContent).toBe(diffOutput);

      const sessionLogExists = await fs.stat(sessionLogPath).then(() => true).catch(() => false);
      expect(sessionLogExists).toBe(true);
    });

    it('should copy session.log when logPath exists and file is present', async () => {
      const candidate = createMockCandidate();
      const logContent = 'Session log content\nline 2\nline 3\n';
      const logPath = path.join(tmpDir, 'source-session.log');
      await fs.writeFile(logPath, logContent, 'utf8');

      const run = createMockRunResult({
        runId: validUuid(),
        candidateId: candidate.id,
        logPath,
      });

      sandbox = createMockSandbox({
        execute: vi.fn().mockResolvedValue({ stdout: 'diff', stderr: '', exitCode: 0 }),
        switchState: vi.fn().mockResolvedValue(undefined),
        runCommand: vi.fn().mockResolvedValue({ stdout: 'diff', stderr: '', exitCode: 0 }),
      });

      runResultRepo = createMockRunResultRepo([run]);
      candidateRepo = createMockCandidateRepo([candidate]);

      const { FailureArtifactExporter } = await import('../../src/infrastructure/failure-artifact-exporter');
      const exporter = new FailureArtifactExporter(runResultRepo, candidateRepo, sandbox);

      const artifact = await exporter.exportForRun(run.runId, { outputDir: tmpDir });

      const copiedLog = await fs.readFile(artifact.sessionLogPath, 'utf8');
      expect(copiedLog).toBe(logContent);
    });

    it('should create metadata session.log when logPath is not set', async () => {
      const candidate = createMockCandidate();
      const run = createMockRunResult({
        runId: validUuid(),
        candidateId: candidate.id,
        logPath: undefined,
      });

      sandbox = createMockSandbox({
        execute: vi.fn().mockResolvedValue({ stdout: 'diff content', stderr: '', exitCode: 0 }),
        switchState: vi.fn().mockResolvedValue(undefined),
        runCommand: vi.fn().mockResolvedValue({ stdout: 'diff content', stderr: '', exitCode: 0 }),
      });

      runResultRepo = createMockRunResultRepo([run]);
      candidateRepo = createMockCandidateRepo([candidate]);

      const { FailureArtifactExporter } = await import('../../src/infrastructure/failure-artifact-exporter');
      const exporter = new FailureArtifactExporter(runResultRepo, candidateRepo, sandbox);

      const artifact = await exporter.exportForRun(run.runId, { outputDir: tmpDir });

      const logContent = await fs.readFile(artifact.sessionLogPath, 'utf8');
      expect(logContent).toContain(run.runId);
      expect(logContent).toContain(run.agentId);
      expect(logContent).toContain(candidate.id);
    });
  });

  describe('exportForRun without sandbox', () => {
    it('should produce partial artifacts when sandbox is not provided', async () => {
      const candidate = createMockCandidate();
      const run = createMockRunResult({
        runId: validUuid(),
        candidateId: candidate.id,
      });

      runResultRepo = createMockRunResultRepo([run]);
      candidateRepo = createMockCandidateRepo([candidate]);

      const { FailureArtifactExporter } = await import('../../src/infrastructure/failure-artifact-exporter');
      const exporter = new FailureArtifactExporter(runResultRepo, candidateRepo);

      const artifact = await exporter.exportForRun(run.runId, { outputDir: tmpDir });

      const diffPath = path.join(tmpDir, run.runId, 'diff.patch');
      const diffContent = await fs.readFile(diffPath, 'utf8');
      expect(diffContent).toContain(candidate.preFixHash);
      expect(diffContent).toContain(candidate.postFixHash);

      const sessionLogExists = await fs.stat(artifact.sessionLogPath).then(() => true).catch(() => false);
      expect(sessionLogExists).toBe(true);

      const groundTruthPath = path.join(tmpDir, run.runId, 'ground-truth.diff');
      const groundTruthContent = await fs.readFile(groundTruthPath, 'utf8');
      expect(groundTruthContent).toContain(candidate.preFixHash!);
      expect(groundTruthContent).toContain(candidate.postFixHash!);
    });
  });

  describe('exportAllFailures', () => {
    it('should process only failed runs', async () => {
      const candidate1 = createMockCandidate({ id: validUuid() });
      const candidate2 = createMockCandidate({ id: validUuid() });
      const candidate3 = createMockCandidate({ id: validUuid() });

      const failedRun1 = createMockRunResult({
        runId: validUuid(),
        candidateId: candidate1.id,
        metrics: { success: false, cost: 0.1, latency: 100, eScore: 0.2 },
      });
      const failedRun2 = createMockRunResult({
        runId: validUuid(),
        candidateId: candidate2.id,
        metrics: { success: false, cost: 0.2, latency: 200, eScore: 0.3 },
      });
      const successRun = createMockRunResult({
        runId: validUuid(),
        candidateId: candidate3.id,
        metrics: { success: true, cost: 0.05, latency: 50, eScore: 1 },
      });

      sandbox = createMockSandbox({
        execute: vi.fn().mockResolvedValue({ stdout: 'diff output', stderr: '', exitCode: 0 }),
        switchState: vi.fn().mockResolvedValue(undefined),
        runCommand: vi.fn().mockResolvedValue({ stdout: 'diff output', stderr: '', exitCode: 0 }),
      });

      runResultRepo = createMockRunResultRepo([failedRun1, failedRun2, successRun]);
      candidateRepo = createMockCandidateRepo([candidate1, candidate2, candidate3]);

      const { FailureArtifactExporter } = await import('../../src/infrastructure/failure-artifact-exporter');
      const exporter = new FailureArtifactExporter(runResultRepo, candidateRepo, sandbox);

      const artifacts = await exporter.exportAllFailures({ outputDir: tmpDir });

      expect(artifacts).toHaveLength(2);

      const runIds = artifacts.map(a => a.runId);
      expect(runIds).toContain(failedRun1.runId);
      expect(runIds).toContain(failedRun2.runId);
      expect(runIds).not.toContain(successRun.runId);
    });

    it('should return empty array when no failed runs exist', async () => {
      const run = createMockRunResult({
        runId: validUuid(),
        metrics: { success: true, cost: 0.05, latency: 50, eScore: 1 },
      });

      runResultRepo = createMockRunResultRepo([run]);
      candidateRepo = createMockCandidateRepo([]);
      sandbox = createMockSandbox();

      const { FailureArtifactExporter } = await import('../../src/infrastructure/failure-artifact-exporter');
      const exporter = new FailureArtifactExporter(runResultRepo, candidateRepo, sandbox);

      const artifacts = await exporter.exportAllFailures({ outputDir: tmpDir });
      expect(artifacts).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle missing candidate gracefully', async () => {
      const run = createMockRunResult({ runId: validUuid() });

      runResultRepo = createMockRunResultRepo([run]);
      candidateRepo = createMockCandidateRepo([]);
      sandbox = createMockSandbox();

      const { FailureArtifactExporter } = await import('../../src/infrastructure/failure-artifact-exporter');
      const exporter = new FailureArtifactExporter(runResultRepo, candidateRepo, sandbox);

      const artifact = await exporter.exportForRun(run.runId, { outputDir: tmpDir });

      expect(artifact).toBeDefined();
      expect(artifact.runId).toBe(run.runId);
    });

    it('should handle sandbox execute failure gracefully', async () => {
      const candidate = createMockCandidate();
      const run = createMockRunResult({
        runId: validUuid(),
        candidateId: candidate.id,
      });

      sandbox = createMockSandbox({
        execute: vi.fn().mockRejectedValue(new Error('sandbox error')),
        switchState: vi.fn().mockResolvedValue(undefined),
        runCommand: vi.fn().mockRejectedValue(new Error('sandbox error')),
      });

      runResultRepo = createMockRunResultRepo([run]);
      candidateRepo = createMockCandidateRepo([candidate]);

      const { FailureArtifactExporter } = await import('../../src/infrastructure/failure-artifact-exporter');
      const exporter = new FailureArtifactExporter(runResultRepo, candidateRepo, sandbox);

      const artifact = await exporter.exportForRun(run.runId, { outputDir: tmpDir });
      expect(artifact).toBeDefined();
      expect(artifact.runId).toBe(run.runId);
    });

    it('should support custom outputDir', async () => {
      const candidate = createMockCandidate();
      const run = createMockRunResult({
        runId: validUuid(),
        candidateId: candidate.id,
      });

      sandbox = createMockSandbox({
        execute: vi.fn().mockResolvedValue({ stdout: 'diff', stderr: '', exitCode: 0 }),
        switchState: vi.fn().mockResolvedValue(undefined),
        runCommand: vi.fn().mockResolvedValue({ stdout: 'diff', stderr: '', exitCode: 0 }),
      });

      runResultRepo = createMockRunResultRepo([run]);
      candidateRepo = createMockCandidateRepo([candidate]);

      const { FailureArtifactExporter } = await import('../../src/infrastructure/failure-artifact-exporter');
      const exporter = new FailureArtifactExporter(runResultRepo, candidateRepo, sandbox);

      const customDir = path.join(tmpDir, 'custom-export-dir');
      const artifact = await exporter.exportForRun(run.runId, { outputDir: customDir });

      expect(artifact.diffPatchPath).toContain(customDir);
      const diffExists = await fs.stat(artifact.diffPatchPath).then(() => true).catch(() => false);
      expect(diffExists).toBe(true);
    });
  });

  describe('interface contract', () => {
    it('should satisfy IFailureArtifactExporter type contract', async () => {
      const run = createMockRunResult();
      runResultRepo = createMockRunResultRepo([run]);
      candidateRepo = createMockCandidateRepo();
      sandbox = createMockSandbox();

      const { FailureArtifactExporter } = await import('../../src/infrastructure/failure-artifact-exporter');
      const exporter: IFailureArtifactExporter = new FailureArtifactExporter(
        runResultRepo, candidateRepo, sandbox,
      );
      expect(exporter).toBeDefined();
      expect(typeof exporter.exportForRun).toBe('function');
      expect(typeof exporter.exportAllFailures).toBe('function');
    });

    it('should expose exportForRun and exportAllFailures with correct signatures', async () => {
      runResultRepo = createMockRunResultRepo();
      candidateRepo = createMockCandidateRepo();
      sandbox = createMockSandbox();

      const { FailureArtifactExporter } = await import('../../src/infrastructure/failure-artifact-exporter');
      const exporter = new FailureArtifactExporter(runResultRepo, candidateRepo, sandbox);

      const forRunDescriptor = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(exporter), 'exportForRun',
      );
      const allDescriptor = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(exporter), 'exportAllFailures',
      );

      expect(forRunDescriptor?.value).toBeInstanceOf(Function);
      expect(forRunDescriptor?.value.length).toBe(2);
      expect(allDescriptor?.value).toBeInstanceOf(Function);
      expect(allDescriptor?.value.length).toBe(1);
    });
  });
});
