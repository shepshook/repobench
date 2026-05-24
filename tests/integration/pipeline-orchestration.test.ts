import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Command } from 'commander';
import { reinitDatabase, db } from '../../src/infrastructure/persistence/database';
import { CandidateRepository } from '../../src/core/repositories/candidate-repository';
import { RunResultRepository } from '../../src/core/repositories/run-result-repository';
import { LeaderboardReporter } from '../../src/core/services/leaderboard-reporter';
import { TerminalReportRenderer } from '../../src/core/services/report-renderer';
import { FailureArtifactExporter } from '../../src/infrastructure/failure-artifact-exporter';
import type { Candidate, RunResult, LeaderboardOptions, FailureArtifact } from '../../src/core/contracts';
import { generateValidUuid, generateValidHash } from '../helpers/dataset';

const CLI_INDEX_PATH = resolve('src/cli/index.ts');

function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: generateValidUuid(),
    hash: generateValidHash(),
    message: 'fix: test bug',
    files: ['src/test.ts'],
    status: 'validated',
    created_at: new Date(),
    repositoryUrl: 'https://github.com/test/repo',
    repositoryName: 'test/repo',
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

describe('Pipeline Orchestration', () => {

  describe('§A — Structural Cohesion (CLI wiring)', () => {

    const EXPECTED_PIPELINE_COMMANDS = [
      'mine',
      'benchmark',
      'evaluate',
      'run-all',
      'report',
      'export-failures',
    ] as const;

    it('should register all pipeline commands via register*Command calls in the CLI entry point', () => {
      const content = readFileSync(CLI_INDEX_PATH, 'utf-8');
      for (const cmd of EXPECTED_PIPELINE_COMMANDS) {
        const pascalName = cmd
          .split('-')
          .map(s => s.charAt(0).toUpperCase() + s.slice(1))
          .join('');
        expect(content).toContain(`register${pascalName}Command`);
      }
    });

    it('should register commands in the pipeline order: mine → benchmark → evaluate → run-all → report → export-failures', () => {
      const content = readFileSync(CLI_INDEX_PATH, 'utf-8');
      // Find the call site occurrences (registerXxxCommand(program)) not the imports
      const registerCalls = EXPECTED_PIPELINE_COMMANDS.map(cmd => {
        const pascalName = cmd
          .split('-')
          .map(s => s.charAt(0).toUpperCase() + s.slice(1))
          .join('');
        // Match full call pattern to avoid import/definition matches
        return `register${pascalName}Command(program)`;
      });

      let lastIndex = -1;
      for (const call of registerCalls) {
        const idx = content.indexOf(call);
        expect(idx).toBeGreaterThan(lastIndex);
        lastIndex = idx;
      }
    });

    it('should export registerMineCommand as a named export for CLI integration', () => {
      const content = readFileSync(CLI_INDEX_PATH, 'utf-8');
      expect(content).toMatch(/registerMineCommand\(program\)/);
    });

    it('should wire all pipeline commands into a single CLI program', async () => {
      const { registerMineCommand } = await import('../../src/cli/mine');
      const { registerBenchmarkCommand } = await import('../../src/cli/benchmark');
      const { registerEvaluateCommand } = await import('../../src/cli/evaluate');
      const { registerRunAllCommand } = await import('../../src/cli/run-all');
      const { registerReportCommand } = await import('../../src/cli/report');
      const { registerExportFailuresCommand } = await import('../../src/cli/export-failures');

      const program = new Command();
      registerMineCommand(program);
      registerBenchmarkCommand(program);
      registerEvaluateCommand(program);
      registerRunAllCommand(program);
      registerReportCommand(program);
      registerExportFailuresCommand(program);

      const registeredNames = program.commands.map(c => c.name());
      expect(registeredNames).toEqual([
        'mine',
        'benchmark',
        'evaluate',
        'run-all',
        'report',
        'export-failures',
      ]);
    });

    it('should export all pipeline command registration functions for programmatic wiring', async () => {
      const mine = await import('../../src/cli/mine');
      const evaluate = await import('../../src/cli/evaluate');
      const runAll = await import('../../src/cli/run-all');
      const report = await import('../../src/cli/report');
      const exportFailures = await import('../../src/cli/export-failures');
      const benchmark = await import('../../src/cli/benchmark');

      expect(typeof mine.registerMineCommand).toBe('function');
      expect(typeof evaluate.registerEvaluateCommand).toBe('function');
      expect(typeof runAll.registerRunAllCommand).toBe('function');
      expect(typeof report.registerReportCommand).toBe('function');
      expect(typeof exportFailures.registerExportFailuresCommand).toBe('function');
      expect(typeof benchmark.registerBenchmarkCommand).toBe('function');
    });

    it('should not import pipeline commands directly without factory pattern', () => {
      const content = readFileSync(CLI_INDEX_PATH, 'utf-8');
      // The CLI should use register*Command helpers, not inline pipeline logic
      expect(content).not.toMatch(/program\.command\('mine'\)\.action/);
    });

    it('should register the pipeline CLI program with correct name and description', async () => {
      const { registerMineCommand } = await import('../../src/cli/mine');
      const { registerEvaluateCommand } = await import('../../src/cli/evaluate');
      const { registerReportCommand } = await import('../../src/cli/report');
      const { registerExportFailuresCommand } = await import('../../src/cli/export-failures');
      const { registerRunAllCommand } = await import('../../src/cli/run-all');
      const { registerBenchmarkCommand } = await import('../../src/cli/benchmark');

      const program = new Command();
      program.name('repobench').description('RepoBench CLI');
      registerMineCommand(program);
      registerBenchmarkCommand(program);
      registerEvaluateCommand(program);
      registerRunAllCommand(program);
      registerReportCommand(program);
      registerExportFailuresCommand(program);

      const helpText = program.helpInformation();
      expect(helpText).toContain('repobench');
      expect(helpText).toContain('RepoBench CLI');
      expect(helpText).toContain('mine');
      expect(helpText).toContain('evaluate');
      expect(helpText).toContain('run-all');
      expect(helpText).toContain('report');
      expect(helpText).toContain('export-failures');
    });
  });

  describe('§B — Pipeline Data Flow Through Database', () => {
    let tempDbPath: string;
    let candidateRepo: CandidateRepository;
    let runResultRepo: RunResultRepository;

    beforeEach(async () => {
      tempDbPath = path.join(os.tmpdir(), `pipeline-flow-test-${Date.now()}-${Math.random()}.db`);
      reinitDatabase(tempDbPath);
      candidateRepo = new CandidateRepository();
      runResultRepo = new RunResultRepository(db);
    });

    afterEach(async () => {
      try {
        await fs.unlink(tempDbPath);
      } catch { /* ignore */ }
    });

    it('should flow candidates from repository to run results across pipeline stages', () => {
      // Stage 1: Mine produces candidates
      const c1 = makeCandidate();
      const c2 = makeCandidate({ status: 'pending' });
      candidateRepo.save(c1);
      candidateRepo.save(c2);

      // Stage 2: Evaluate reads validated/pending candidates
      const allCandidates = candidateRepo.getAll();
      const pipelineCandidates = allCandidates.filter(
        c => c.status === 'validated' || c.status === 'pending'
      );
      expect(pipelineCandidates).toHaveLength(2);

      // Stage 3: Evaluate stores run results
      const r1 = makeRunResult(c1.id);
      const r2 = makeRunResult(c2.id, { metrics: { success: false, cost: 2.0, latency: 200, eScore: 0.3 } });
      runResultRepo.save(r1);
      runResultRepo.save(r2);

      // Stage 4: Report reads run results
      const allRuns = runResultRepo.getAll();
      expect(allRuns).toHaveLength(2);
      expect(allRuns.some(r => r.candidateId === c1.id)).toBe(true);
      expect(allRuns.some(r => r.candidateId === c2.id)).toBe(true);
    });

    it('should produce a leaderboard from persisted run results after evaluation', async () => {
      // Simulate: mine produces candidates
      const c1 = makeCandidate();
      const c2 = makeCandidate();
      candidateRepo.save(c1);
      candidateRepo.save(c2);

      // Simulate: evaluate produces run results
      runResultRepo.save(makeRunResult(c1.id, {
        agentId: 'agent-alpha',
        metrics: { success: true, cost: 0.5, latency: 50, eScore: 0.95 },
      }));
      runResultRepo.save(makeRunResult(c2.id, {
        agentId: 'agent-alpha',
        metrics: { success: false, cost: 2.0, latency: 300, eScore: 0.2 },
      }));

      // Report: generate leaderboard
      const reporter = new LeaderboardReporter(runResultRepo);
      const options: LeaderboardOptions = {
        sortBy: 'eScore',
        sortOrder: 'desc',
        limit: 10,
      };
      const entries = await reporter.getLeaderboard(options);

      expect(entries.length).toBeGreaterThanOrEqual(1);
      const alphaEntry = entries.find(e => e.agentId === 'agent-alpha');
      expect(alphaEntry).toBeDefined();
      expect(alphaEntry!.totalRuns).toBe(2);
      expect(alphaEntry!.successfulRuns).toBe(1);
      expect(alphaEntry!.failedRuns).toBe(1);
      expect(alphaEntry!.avgEScore).toBeCloseTo(0.575, 1);
    });

    it('should flow failed run results into export-failures pipeline stage', () => {
      // Simulate: mine → evaluate produces mixed results
      const cPass = makeCandidate();
      const cFail = makeCandidate();
      candidateRepo.save(cPass);
      candidateRepo.save(cFail);

      const passedRun = makeRunResult(cPass.id, {
        agentId: 'agent-alpha',
        metrics: { success: true, cost: 1, latency: 100, eScore: 0.9 },
      });
      const failedRun = makeRunResult(cFail.id, {
        agentId: 'agent-alpha',
        metrics: { success: false, cost: 3, latency: 500, eScore: 0.0 },
      });
      runResultRepo.save(passedRun);
      runResultRepo.save(failedRun);

      // export-failures: find failed runs by checking run results
      const allRuns = runResultRepo.getAll();
      const failedRuns = allRuns.filter(r => !r.metrics.success);
      expect(failedRuns).toHaveLength(1);
      expect(failedRuns[0].runId).toBe(failedRun.runId);
      expect(failedRuns[0].candidateId).toBe(cFail.id);
    });

    it('should produce renderable leaderboard after full pipeline flow', async () => {
      // Full flow: candidates → run results → leaderboard → rendered table
      const c1 = makeCandidate();
      const c2 = makeCandidate();
      candidateRepo.save(c1);
      candidateRepo.save(c2);

      runResultRepo.save(makeRunResult(c1.id, {
        agentId: 'agent-alpha',
        metrics: { success: true, cost: 0.5, latency: 50, eScore: 0.95 },
      }));
      runResultRepo.save(makeRunResult(c2.id, {
        agentId: 'agent-alpha',
        metrics: { success: true, cost: 1.0, latency: 100, eScore: 0.85 },
      }));
      runResultRepo.save(makeRunResult(c1.id, {
        agentId: 'agent-beta',
        metrics: { success: false, cost: 3.0, latency: 500, eScore: 0.0 },
      }));

      const reporter = new LeaderboardReporter(runResultRepo);
      const renderer = new TerminalReportRenderer();
      const entries = await reporter.getLeaderboard({
        sortBy: 'eScore',
        sortOrder: 'desc',
        limit: 10,
      });

      expect(entries).toHaveLength(2);
      expect(entries[0].agentId).toBe('agent-alpha');
      expect(entries[1].agentId).toBe('agent-beta');
      expect(entries[0].avgEScore).toBeGreaterThan(entries[1].avgEScore);

      const rendered = renderer.render(entries);
      expect(rendered).toContain('agent-alpha');
      expect(rendered).toContain('agent-beta');
      expect(rendered).toContain('Rank');
      expect(rendered).toContain('Avg E-Score');
    });
  });

  describe('§C — Pipeline State Isolation & Recovery', () => {
    let tempDbPath: string;
    let candidateRepo: CandidateRepository;
    let runResultRepo: RunResultRepository;

    beforeEach(async () => {
      tempDbPath = path.join(os.tmpdir(), `pipeline-recovery-test-${Date.now()}-${Math.random()}.db`);
      reinitDatabase(tempDbPath);
      candidateRepo = new CandidateRepository();
      runResultRepo = new RunResultRepository(db);
    });

    afterEach(async () => {
      try {
        await fs.unlink(tempDbPath);
      } catch { /* ignore */ }
    });

    it('should handle running evaluate stage before mine stage (no candidates)', () => {
      const candidates = candidateRepo.getAll();
      expect(candidates).toHaveLength(0);
      const pipelineCandidates = candidates.filter(
        c => c.status === 'validated' || c.status === 'pending'
      );
      expect(pipelineCandidates).toHaveLength(0);
    });

    it('should handle running report stage before evaluate stage (no run results)', () => {
      const allRuns = runResultRepo.getAll();
      expect(allRuns).toHaveLength(0);
    });

    it('should handle running export-failures stage before evaluate stage (no failures)', () => {
      const allRuns = runResultRepo.getAll();
      const failedRuns = allRuns.filter(r => !r.metrics.success);
      expect(failedRuns).toHaveLength(0);
    });

    it('should preserve state isolation between sequential pipeline runs', () => {
      // First pipeline run
      const c1 = makeCandidate();
      candidateRepo.save(c1);

      const r1 = makeRunResult(c1.id, { agentId: 'agent-v1' });
      runResultRepo.save(r1);

      expect(runResultRepo.getAll()).toHaveLength(1);

      // Second pipeline run with new DB state (simulating fresh pipeline)
      const tempDbPath2 = path.join(os.tmpdir(), `pipeline-recovery-test-2-${Date.now()}-${Math.random()}.db`);
      reinitDatabase(tempDbPath2);
      candidateRepo = new CandidateRepository();
      runResultRepo = new RunResultRepository(db);

      expect(candidateRepo.getAll()).toHaveLength(0);
      expect(runResultRepo.getAll()).toHaveLength(0);
    });

    it('should clear previous pipeline state when reinitDatabase is called between runs', () => {
      // First pipeline run fills the DB
      candidateRepo.save(makeCandidate());
      runResultRepo.save(makeRunResult(generateValidUuid()));
      expect(runResultRepo.getAll().length).toBeGreaterThan(0);

      // Re-init (simulating new project pipeline run)
      const freshDbPath = path.join(os.tmpdir(), `pipeline-fresh-${Date.now()}-${Math.random()}.db`);
      reinitDatabase(freshDbPath);

      const freshCandidateRepo = new CandidateRepository();
      const freshRunResultRepo = new RunResultRepository(db);
      expect(freshCandidateRepo.getAll()).toHaveLength(0);
      expect(freshRunResultRepo.getAll()).toHaveLength(0);
    });
  });

  describe('§D — Pipeline Command Registration Contracts', () => {
    it('should have mine command with --repo and --config options per ARCHITECTURE.md §7.2', async () => {
      const { registerMineCommand } = await import('../../src/cli/mine');
      const program = new Command();
      registerMineCommand(program);
      const mineCmd = program.commands.find(c => c.name() === 'mine')!;
      expect(mineCmd).toBeDefined();
      expect(mineCmd.options.some(o => o.long === '--repo')).toBe(true);
      expect(mineCmd.options.some(o => o.long === '--config')).toBe(true);
    });

    it('should have run-all command with --agents, --concurrency, --timeout, --dry-run per ARCHITECTURE.md §7.2', async () => {
      const { registerRunAllCommand } = await import('../../src/cli/run-all');
      const program = new Command();
      registerRunAllCommand(program);
      const runAllCmd = program.commands.find(c => c.name() === 'run-all')!;
      expect(runAllCmd).toBeDefined();
      expect(runAllCmd.options.some(o => o.long === '--agents')).toBe(true);
      expect(runAllCmd.options.some(o => o.long === '--concurrency')).toBe(true);
      expect(runAllCmd.options.some(o => o.long === '--timeout')).toBe(true);
      expect(runAllCmd.options.some(o => o.long === '--dry-run')).toBe(true);
    });

    it('should have export-failures command with --output-dir and --run-id per ARCHITECTURE.md §7.2', async () => {
      const { registerExportFailuresCommand } = await import('../../src/cli/export-failures');
      const program = new Command();
      registerExportFailuresCommand(program);
      const exportCmd = program.commands.find(c => c.name() === 'export-failures')!;
      expect(exportCmd).toBeDefined();
      expect(exportCmd.options.some(o => o.long === '--output-dir')).toBe(true);
      expect(exportCmd.options.some(o => o.long === '--run-id')).toBe(true);
    });

    it('should have report command with --sort-by, --order, --limit per ARCHITECTURE.md §7.2', async () => {
      const { registerReportCommand } = await import('../../src/cli/report');
      const program = new Command();
      registerReportCommand(program);
      const reportCmd = program.commands.find(c => c.name() === 'report')!;
      expect(reportCmd).toBeDefined();
      expect(reportCmd.options.some(o => o.long === '--sort-by')).toBe(true);
      expect(reportCmd.options.some(o => o.long === '--order')).toBe(true);
      expect(reportCmd.options.some(o => o.long === '--limit')).toBe(true);
    });

    it('should have evaluate command with --project, --agent-id, --log-path per ARCHITECTURE.md §7.2', async () => {
      const { registerEvaluateCommand } = await import('../../src/cli/evaluate');
      const program = new Command();
      registerEvaluateCommand(program);
      const evalCmd = program.commands.find(c => c.name() === 'evaluate')!;
      expect(evalCmd).toBeDefined();
      expect(evalCmd.options.some(o => o.long === '--project')).toBe(true);
      expect(evalCmd.options.some(o => o.long === '--agent-id')).toBe(true);
      expect(evalCmd.options.some(o => o.long === '--log-path')).toBe(true);
    });
  });

  describe('§E — Pipeline Artifact Export (Real File I/O)', () => {
    let tempDbPath: string;
    let tempExportDir: string;
    let candidateRepo: CandidateRepository;
    let runResultRepo: RunResultRepository;
    let exporter: FailureArtifactExporter;

    beforeEach(async () => {
      tempDbPath = path.join(os.tmpdir(), `pipeline-artifact-test-${Date.now()}-${Math.random()}.db`);
      tempExportDir = path.join(os.tmpdir(), `pipeline-export-${Date.now()}-${Math.random()}`);
      reinitDatabase(tempDbPath);
      candidateRepo = new CandidateRepository();
      runResultRepo = new RunResultRepository(db);
      exporter = new FailureArtifactExporter(runResultRepo, candidateRepo);
    });

    afterEach(async () => {
      try {
        await fs.unlink(tempDbPath);
      } catch { /* ignore */ }
      try {
        await fs.rm(tempExportDir, { recursive: true, force: true });
      } catch { /* ignore */ }
    });

    it('should create artifact files on disk for a failed run using real exporter', async () => {
      const c = makeCandidate();
      candidateRepo.save(c);

      const runId = generateValidUuid();
      const failedRun = makeRunResult(c.id, {
        runId,
        metrics: { success: false, cost: 3.0, latency: 500, eScore: 0.0 },
      });
      runResultRepo.save(failedRun);

      const artifacts = await exporter.exportAllFailures({ outputDir: tempExportDir });

      expect(artifacts).toHaveLength(1);
      const artifact = artifacts[0];
      expect(artifact.runId).toBe(runId);
      expect(artifact.candidateId).toBe(c.id);
      expect(artifact.regressionStatus).toBe('regressed');

      // Verify actual file creation on disk
      expect(existsSync(artifact.diffPatchPath)).toBe(true);
      expect(existsSync(artifact.sessionLogPath)).toBe(true);
      expect(existsSync(artifact.groundTruthPath)).toBe(true);

      const diffContent = await fs.readFile(artifact.diffPatchPath, 'utf8');
      expect(diffContent).toContain('Sandbox unavailable');
    });

    it('should create export directory structure correctly', async () => {
      const c = makeCandidate();
      candidateRepo.save(c);
      const runId = generateValidUuid();
      runResultRepo.save(makeRunResult(c.id, {
        runId,
        metrics: { success: false, cost: 1, latency: 100, eScore: 0.0 },
      }));

      const [artifact] = await exporter.exportAllFailures({ outputDir: tempExportDir });

      expect(artifact.diffPatchPath).toContain(tempExportDir);
      expect(artifact.diffPatchPath).toContain(runId);
      expect(artifact.diffPatchPath).toContain('diff.patch');
    });

    it('should export only failed runs and skip successful ones', async () => {
      const c1 = makeCandidate();
      const c2 = makeCandidate();
      candidateRepo.save(c1);
      candidateRepo.save(c2);

      runResultRepo.save(makeRunResult(c1.id, {
        metrics: { success: true, cost: 0.5, latency: 50, eScore: 0.9 },
      }));
      runResultRepo.save(makeRunResult(c2.id, {
        metrics: { success: false, cost: 2.0, latency: 300, eScore: 0.1 },
      }));

      const artifacts = await exporter.exportAllFailures({ outputDir: tempExportDir });

      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].candidateId).toBe(c2.id);
    });

    it('should export a single run by ID using exportForRun', async () => {
      const c = makeCandidate();
      candidateRepo.save(c);
      const runId = generateValidUuid();
      runResultRepo.save(makeRunResult(c.id, {
        runId,
        metrics: { success: false, cost: 5.0, latency: 1000, eScore: 0.0 },
      }));

      const artifact = await exporter.exportForRun(runId, { outputDir: tempExportDir });

      expect(artifact.runId).toBe(runId);
      expect(existsSync(artifact.diffPatchPath)).toBe(true);
      expect(existsSync(artifact.sessionLogPath)).toBe(true);
      expect(existsSync(artifact.groundTruthPath)).toBe(true);
    });

    it('should throw when exporting a successful run via exportForRun', async () => {
      const c = makeCandidate();
      candidateRepo.save(c);
      const runId = generateValidUuid();
      runResultRepo.save(makeRunResult(c.id, {
        runId,
        metrics: { success: true, cost: 1, latency: 100, eScore: 0.9 },
      }));

      await expect(exporter.exportForRun(runId, { outputDir: tempExportDir }))
        .rejects.toThrow(/successful/);
    });

    it('should throw when exporting a nonexistent run via exportForRun', async () => {
      await expect(exporter.exportForRun(generateValidUuid(), { outputDir: tempExportDir }))
        .rejects.toThrow(/not found/);
    });

    it('should generate session.log with run metadata when no logPath is set', async () => {
      const c = makeCandidate();
      candidateRepo.save(c);
      const runId = generateValidUuid();
      runResultRepo.save(makeRunResult(c.id, {
        runId,
        metrics: { success: false, cost: 2.0, latency: 300, eScore: 0.0 },
      }));

      const [artifact] = await exporter.exportAllFailures({ outputDir: tempExportDir });
      const sessionContent = await fs.readFile(artifact.sessionLogPath, 'utf8');
      const parsed = JSON.parse(sessionContent);

      expect(parsed.runId).toBe(runId);
      expect(parsed.agentId).toBe('test-agent');
      expect(parsed.metrics.success).toBe(false);
    });

    it('should handle exportAllFailures returning empty array when no failures exist', async () => {
      const c = makeCandidate();
      candidateRepo.save(c);
      runResultRepo.save(makeRunResult(c.id, {
        metrics: { success: true, cost: 0.5, latency: 50, eScore: 0.9 },
      }));

      const artifacts = await exporter.exportAllFailures({ outputDir: tempExportDir });
      expect(artifacts).toHaveLength(0);
    });
  });
});
