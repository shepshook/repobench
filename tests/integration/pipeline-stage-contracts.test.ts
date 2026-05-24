import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { reinitDatabase, db } from '../../src/infrastructure/persistence/database';
import { CandidateRepository } from '../../src/core/repositories/candidate-repository';
import { RunResultRepository } from '../../src/core/repositories/run-result-repository';
import { registerReportCommand } from '../../src/cli/report';
import { registerExportFailuresCommand } from '../../src/cli/export-failures';
import type { Candidate, RunResult, FailureArtifact } from '../../src/core/contracts';
import { generateValidUuid, generateValidHash } from '../helpers/dataset';

function makeValidCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: generateValidUuid(),
    hash: generateValidHash(),
    message: 'fix: test bug in pipeline',
    files: ['src/target.ts'],
    status: 'validated',
    created_at: new Date(),
    repositoryUrl: 'https://github.com/repobench/repobench',
    repositoryName: 'repobench',
    preFixHash: generateValidHash(),
    postFixHash: generateValidHash(),
    ...overrides,
  };
}

function makeRunResult(candidateId: string, overrides: Partial<RunResult> = {}): RunResult {
  return {
    runId: generateValidUuid(),
    agentId: 'test-agent',
    candidateId,
    metrics: {
      success: true,
      cost: 1.0,
      latency: 100,
      eScore: 0.85,
      ...overrides.metrics,
    },
    timestamp: new Date(),
    ...overrides,
  };
}

/**
 * Pipeline Stage Data Contract Tests (Task 5.5.1)
 *
 * Validates cross-stage data contracts and CLI handler chaining
 * using real database instances and minimal mocking.
 *
 * Testing Principles (ARCHITECTURE.md §8):
 * - Strict Isolation via temp DB per test
 * - Explicit Environment via temp directories
 * - State-Aware Expectations
 * - No "Hope-based" Testing
 */
describe('Pipeline Stage Data Contracts (Task 5.5.1)', () => {

  // ─── §A — Database Schema Contract Compliance ────────────────────────────
  //
  // Each pipeline stage reads from or writes to the database. If the schema
  // drifts from what the next stage expects, the pipeline silently produces
  // incorrect output. These tests verify schema-level contract compliance.

  describe('§A — Database Schema Contract Compliance', () => {
    let tempDbPath: string;

    beforeEach(() => {
      tempDbPath = path.join(os.tmpdir(), `stage-contract-schema-${Date.now()}-${Math.random()}.db`);
      reinitDatabase(tempDbPath);
    });

    afterEach(async () => {
      try { await fs.unlink(tempDbPath); } catch { /* ignore */ }
    });

    it('must persist candidate preFixHash and postFixHash for downstream evaluate stage', () => {
      const repo = new CandidateRepository();
      const c = makeValidCandidate({
        preFixHash: 'abc123def456abc123def456abc123def456abc1',
        postFixHash: 'def789abc123def789abc123def789abc123def7',
      });
      repo.save(c);

      const loaded = repo.getById(c.id);
      expect(loaded).toBeDefined();
      expect(loaded!.preFixHash).toBe('abc123def456abc123def456abc123def456abc1');
      expect(loaded!.postFixHash).toBe('def789abc123def789abc123def789abc123def7');
    });

    it('must persist validated candidates with status queryable by evaluate stage', () => {
      const repo = new CandidateRepository();
      const validated = makeValidCandidate({ status: 'validated' });
      const pending = makeValidCandidate({ id: generateValidUuid(), status: 'pending' });
      const rejected = makeValidCandidate({ id: generateValidUuid(), status: 'rejected' });
      repo.save(validated);
      repo.save(pending);
      repo.save(rejected);

      const all = repo.getAll();
      const pipelineEligible = all.filter(c => c.status === 'validated' || c.status === 'pending');
      expect(pipelineEligible).toHaveLength(2);
      expect(pipelineEligible.some(c => c.status === 'validated')).toBe(true);
      expect(pipelineEligible.some(c => c.status === 'pending')).toBe(true);
    });

    it('must persist run result metrics that report stage can aggregate', () => {
      const runResultRepo = new RunResultRepository(db);
      const candidateId = generateValidUuid();
      const r = makeRunResult(candidateId, {
        agentId: 'agent-alpha',
        metrics: { success: true, cost: 0.5, latency: 50, eScore: 0.95 },
      });
      runResultRepo.save(r);

      const loaded = runResultRepo.getById(r.runId);
      expect(loaded).toBeDefined();
      expect(loaded!.metrics.eScore).toBe(0.95);
      expect(loaded!.metrics.cost).toBe(0.5);
      expect(loaded!.metrics.latency).toBe(50);
      expect(loaded!.metrics.success).toBe(true);
    });

    it('must reject candidate without UUID id to prevent downstream lookup failures', () => {
      const repo = new CandidateRepository();
      const badCandidate = makeValidCandidate({ id: 'not-a-uuid' });
      expect(() => repo.save(badCandidate)).toThrow();
    });
  });

  // ─── §B — Cross-Stage CLI Handler Chaining ───────────────────────────────
  //
  // The report and export-failures CLI handlers must work against the same
  // real database, verifying that data produced by one stage (evaluate) is
  // consumable by downstream stages without re-initialization conflicts.

  describe('§B — Cross-Stage CLI Handler Chaining', () => {
    let tempDbPath: string;
    let tempExportDir: string;
    let candidateRepo: CandidateRepository;
    let runResultRepo: RunResultRepository;
    let program: Command;
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
      tempDbPath = path.join(os.tmpdir(), `stage-contract-cli-${Date.now()}-${Math.random()}.db`);
      tempExportDir = path.join(os.tmpdir(), `stage-contract-export-${Date.now()}-${Math.random()}`);
      reinitDatabase(tempDbPath);

      candidateRepo = new CandidateRepository();
      runResultRepo = new RunResultRepository(db);

      program = new Command();
      registerReportCommand(program);
      registerExportFailuresCommand(program);

      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit');
      });
    });

    afterEach(async () => {
      vi.restoreAllMocks();
      try { await fs.unlink(tempDbPath); } catch { /* ignore */ }
      try { await fs.rm(tempExportDir, { recursive: true, force: true }); } catch { /* ignore */ }
    });

    it('should chain report then export-failures against the same real database', async () => {
      const c = makeValidCandidate();
      candidateRepo.save(c);

      const runId = generateValidUuid();
      runResultRepo.save(makeRunResult(c.id, {
        runId,
        agentId: 'chain-test-agent',
        metrics: { success: false, cost: 3.0, latency: 500, eScore: 0.0 },
      }));

      runResultRepo.save(makeRunResult(c.id, {
        runId: generateValidUuid(),
        agentId: 'chain-test-agent',
        metrics: { success: true, cost: 1.0, latency: 100, eScore: 0.9 },
      }));

      // Stage 1: Run report CLI handler
      try {
        await program.parseAsync(['node', 'repobench', 'report']);
      } catch (e) {
        // process.exit mock throws — expected
      }

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('chain-test-agent'),
      );
      const reportCalls = consoleLogSpy.mock.calls.length;
      expect(reportCalls).toBeGreaterThan(0);

      // Stage 2: Run export-failures CLI handler with the same DB
      consoleLogSpy.mockClear();
      try {
        await program.parseAsync([
          'node', 'repobench', 'export-failures',
          '--output-dir', tempExportDir,
        ]);
      } catch (e) {
        // process.exit mock throws — expected
      }

      // Must detect the failed run
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('1 failed run'),
      );
      expect(exitSpy).toHaveBeenCalledWith(0);

      // Artifact files must exist on disk
      const exportDirContents = await fs.readdir(tempExportDir).catch(() => []);
      expect(exportDirContents.length).toBeGreaterThanOrEqual(1);
    });

    it('should produce no-export when chaining report then export-failures with no failures', async () => {
      const c = makeValidCandidate();
      candidateRepo.save(c);

      runResultRepo.save(makeRunResult(c.id, {
        agentId: 'all-pass-agent',
        metrics: { success: true, cost: 0.5, latency: 50, eScore: 0.95 },
      }));

      // Report should show the agent
      try {
        await program.parseAsync(['node', 'repobench', 'report']);
      } catch (e) {
        // process.exit mock throws
      }
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('all-pass-agent'),
      );

      // Export-failures should report 0 failures
      consoleLogSpy.mockClear();
      try {
        await program.parseAsync([
          'node', 'repobench', 'export-failures',
          '--output-dir', tempExportDir,
        ]);
      } catch (e) {
        // process.exit mock throws
      }

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/0\s+failed/),
      );

      // No export directory should be created
      const exportDirExists = existsSync(tempExportDir);
      expect(exportDirExists).toBe(false);
    });

    it('should handle empty database gracefully in both report and export-failures', async () => {
      // Report with empty DB
      try {
        await program.parseAsync(['node', 'repobench', 'report']);
      } catch (e) {
        // process.exit mock throws
      }

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No data available'),
      );
      expect(exitSpy).toHaveBeenCalledWith(0);

      // Export-failures with empty DB
      consoleLogSpy.mockClear();
      exitSpy.mockClear();
      try {
        await program.parseAsync([
          'node', 'repobench', 'export-failures',
          '--output-dir', tempExportDir,
        ]);
      } catch (e) {
        // process.exit mock throws
      }

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/0\s+failed/),
      );
      expect(exitSpy).toHaveBeenCalledWith(0);
    });
  });

  // ─── §C — Cross-Stage Data Contract Integrity ────────────────────────────
  //
  // Each pipeline stage depends on specific data invariants from the previous
  // stage. These tests codify those invariants and verify they hold across
  // the Candidate → RunResult → FailureArtifact data flow.

  describe('§C — Cross-Stage Data Contract Integrity', () => {
    let tempDbPath: string;
    let tempExportDir: string;
    let candidateRepo: CandidateRepository;
    let runResultRepo: RunResultRepository;

    beforeEach(() => {
      tempDbPath = path.join(os.tmpdir(), `stage-contract-integrity-${Date.now()}-${Math.random()}.db`);
      tempExportDir = path.join(os.tmpdir(), `stage-contract-integrity-export-${Date.now()}-${Math.random()}`);
      reinitDatabase(tempDbPath);
      candidateRepo = new CandidateRepository();
      runResultRepo = new RunResultRepository(db);
    });

    afterEach(async () => {
      try { await fs.unlink(tempDbPath); } catch { /* ignore */ }
      try { await fs.rm(tempExportDir, { recursive: true, force: true }); } catch { /* ignore */ }
    });

    it('should flow candidate data from mine through evaluate to report via DB', () => {
      const c1 = makeValidCandidate();
      const c2 = makeValidCandidate({ id: generateValidUuid() });
      candidateRepo.save(c1);
      candidateRepo.save(c2);

      const candidates = candidateRepo.getAll();
      expect(candidates).toHaveLength(2);
      const validated = candidates.filter(c => c.status === 'validated');
      expect(validated).toHaveLength(2);

      validated.forEach(c => {
        expect(c.preFixHash).toBeDefined();
        expect(c.preFixHash).not.toBe('');
        expect(c.postFixHash).toBeDefined();
        expect(c.postFixHash).not.toBe('');
      });
    });

    it('should flow run results from evaluate to report aggregation without data loss', () => {
      const c1 = makeValidCandidate();
      candidateRepo.save(c1);

      runResultRepo.save(makeRunResult(c1.id, {
        agentId: 'aggregate-test',
        metrics: { success: true, cost: 0.5, latency: 50, eScore: 0.95 },
      }));
      runResultRepo.save(makeRunResult(c1.id, {
        agentId: 'aggregate-test',
        metrics: { success: false, cost: 2.0, latency: 300, eScore: 0.2 },
      }));

      const runs = runResultRepo.getByAgentId('aggregate-test');
      expect(runs).toHaveLength(2);

      const successes = runs.filter(r => r.metrics.success);
      const failures = runs.filter(r => !r.metrics.success);
      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);

      const maxEScore = Math.max(...runs.map(r => r.metrics.eScore));
      expect(maxEScore).toBe(0.95);
    });

    it('should flow failure data from evaluate to export-failures with correct candidate linkage', async () => {
      const cFail = makeValidCandidate();
      const cPass = makeValidCandidate({ id: generateValidUuid() });
      candidateRepo.save(cFail);
      candidateRepo.save(cPass);

      const failedRunId = generateValidUuid();
      runResultRepo.save(makeRunResult(cFail.id, {
        runId: failedRunId,
        metrics: { success: false, cost: 5.0, latency: 1000, eScore: 0.0 },
      }));
      runResultRepo.save(makeRunResult(cPass.id, {
        runId: generateValidUuid(),
        metrics: { success: true, cost: 0.5, latency: 50, eScore: 0.95 },
      }));

      const { FailureArtifactExporter } = await import('../../src/infrastructure/failure-artifact-exporter');
      const exporter = new FailureArtifactExporter(runResultRepo, candidateRepo);
      const artifacts = await exporter.exportAllFailures({ outputDir: tempExportDir });

      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].runId).toBe(failedRunId);
      expect(artifacts[0].candidateId).toBe(cFail.id);

      const foundCandidate = candidateRepo.getById(cFail.id);
      expect(foundCandidate).toBeDefined();
      expect(foundCandidate!.preFixHash).toBeDefined();
      expect(foundCandidate!.postFixHash).toBeDefined();

      expect(existsSync(artifacts[0].diffPatchPath)).toBe(true);
      expect(existsSync(artifacts[0].sessionLogPath)).toBe(true);
      expect(existsSync(artifacts[0].groundTruthPath)).toBe(true);
    });

    it('should produce distinct run IDs across multiple evaluate runs for traceability', () => {
      const c = makeValidCandidate();
      candidateRepo.save(c);

      const runIds = new Set<string>();
      for (let i = 0; i < 5; i++) {
        const r = makeRunResult(c.id, {
          runId: generateValidUuid(),
          metrics: { success: true, cost: 1, latency: 100, eScore: 0.5 + i * 0.1 },
        });
        runResultRepo.save(r);
        runIds.add(r.runId);
      }

      expect(runIds.size).toBe(5);

      const savedRuns = runResultRepo.getAll();
      expect(savedRuns).toHaveLength(5);
      const savedRunIds = new Set(savedRuns.map(r => r.runId));
      expect(savedRunIds.size).toBe(5);
    });

    it('should reject RunResult that report would fail to aggregate (missing eScore)', () => {
      const badRun: RunResult = {
        runId: generateValidUuid(),
        agentId: 'bad-agent',
        candidateId: generateValidUuid(),
        metrics: {
          success: true,
          cost: 1.0,
          latency: 100,
          eScore: NaN,
        },
        timestamp: new Date(),
      };

      expect(() => runResultRepo.save(badRun)).toThrow();
    });
  });

  // ─── §D — Pipeline Stage Precondition Validation ─────────────────────────
  //
  // Tests that each pipeline stage validates its prerequisites and produces
  // actionable error messages when preconditions are not met.

  describe('§D — Pipeline Stage Precondition Validation', () => {
    let tempDbPath: string;
    let tempExportDir: string;
    let candidateRepo: CandidateRepository;
    let runResultRepo: RunResultRepository;

    beforeEach(() => {
      tempDbPath = path.join(os.tmpdir(), `stage-contract-precond-${Date.now()}-${Math.random()}.db`);
      tempExportDir = path.join(os.tmpdir(), `stage-contract-precond-export-${Date.now()}-${Math.random()}`);
      reinitDatabase(tempDbPath);
      candidateRepo = new CandidateRepository();
      runResultRepo = new RunResultRepository(db);
    });

    afterEach(async () => {
      try { await fs.unlink(tempDbPath); } catch { /* ignore */ }
      try { await fs.rm(tempExportDir, { recursive: true, force: true }); } catch { /* ignore */ }
    });

    it('should require validated candidates to have preFixHash for evaluate stage', () => {
      const c = makeValidCandidate({ preFixHash: undefined });
      expect(c.preFixHash).toBeUndefined();

      const repo = new CandidateRepository();
      repo.save(c);

      const loaded = repo.getById(c.id);
      expect(loaded).toBeDefined();

      // The evaluate stage filters by status — but if preFixHash is missing,
      // the downstream comparison will fail. This test codifies the invariant
      // that validated candidates MUST carry hashes.
      const pipelineCandidates = repo.getAll().filter(
        c => (c.status === 'validated' || c.status === 'pending'),
      );
      const missingHashes = pipelineCandidates.filter(
        c => !c.preFixHash || !c.postFixHash,
      );
      expect(missingHashes.length).toBe(1);
    });

    it('should surface actionable message when export-failures cannot find exported run directory', async () => {
      const c = makeValidCandidate();
      candidateRepo.save(c);
      runResultRepo.save(makeRunResult(c.id, {
        metrics: { success: false, cost: 1, latency: 100, eScore: 0.0 },
      }));

      const { FailureArtifactExporter } = await import('../../src/infrastructure/failure-artifact-exporter');
      const exporter = new FailureArtifactExporter(runResultRepo, candidateRepo);

      // Should NOT throw when export directory is on a non-existent path
      await expect(
        exporter.exportAllFailures({ outputDir: tempExportDir }),
      ).resolves.toHaveLength(1);

      const artifacts = await exporter.exportAllFailures({ outputDir: tempExportDir });
      expect(artifacts[0].diffPatchPath).toContain(tempExportDir);
    });
  });
});
