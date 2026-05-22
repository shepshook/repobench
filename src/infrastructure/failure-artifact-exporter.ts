import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  IRunResultRepository,
  ICandidateRepository,
  ISandbox,
  FailureArtifact,
} from '../core/contracts.js';

export class FailureArtifactExporter {
  constructor(
    private readonly runResultRepo: IRunResultRepository,
    private readonly candidateRepo: ICandidateRepository,
    private readonly sandbox?: ISandbox,
  ) {}

  async exportForRun(runId: string, options?: { outputDir?: string }): Promise<FailureArtifact> {
    const run = this.runResultRepo.getById(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    if (run.metrics.success) {
      throw new Error(`Run ${runId} was successful; no artifacts to export`);
    }

    const outputDir = options?.outputDir ?? 'exports';
    const exportDir = path.join(outputDir, runId);
    await fs.mkdir(exportDir, { recursive: true });

    const candidate = this.candidateRepo.getById(run.candidateId);

    // --- diff.patch ---
    const diffPatchPath = path.join(exportDir, 'diff.patch');
    if (candidate?.preFixHash && this.sandbox) {
      try {
        await this.sandbox.switchState(candidate.preFixHash);
        const result = await this.sandbox.execute('git diff');
        await fs.writeFile(diffPatchPath, result.stdout, 'utf8');
      } catch {
        if (candidate.postFixHash) {
          await fs.writeFile(diffPatchPath, `Diff unavailable. Pre: ${candidate.preFixHash}, Post: ${candidate.postFixHash}`, 'utf8');
        } else {
          await fs.writeFile(diffPatchPath, `Diff unavailable for hash ${candidate.preFixHash}`, 'utf8');
        }
      }
    } else if (candidate?.preFixHash && candidate?.postFixHash) {
      await fs.writeFile(diffPatchPath, `Sandbox unavailable. Pre: ${candidate.preFixHash}, Post: ${candidate.postFixHash}`, 'utf8');
    } else {
      await fs.writeFile(diffPatchPath, `Cannot generate diff.patch for run ${runId}`, 'utf8');
    }

    // --- session.log ---
    const sessionLogPath = path.join(exportDir, 'session.log');
    if (run.logPath) {
      try {
        await fs.copyFile(run.logPath, sessionLogPath);
      } catch {
        await fs.writeFile(sessionLogPath, JSON.stringify({
          runId: run.runId,
          agentId: run.agentId,
          candidateId: run.candidateId,
          metrics: run.metrics,
          timestamp: run.timestamp,
          note: `source log not found at ${run.logPath}`,
        }, null, 2), 'utf8');
      }
    } else {
      await fs.writeFile(sessionLogPath, JSON.stringify({
        runId: run.runId,
        agentId: run.agentId,
        candidateId: run.candidateId,
        metrics: run.metrics,
        timestamp: run.timestamp,
      }, null, 2), 'utf8');
    }

    // --- ground-truth.diff ---
    const groundTruthPath = path.join(exportDir, 'ground-truth.diff');
    if (candidate?.preFixHash && candidate?.postFixHash && this.sandbox) {
      try {
        const result = await this.sandbox.runCommand(`git diff ${candidate.preFixHash} ${candidate.postFixHash}`);
        await fs.writeFile(groundTruthPath, result.stdout, 'utf8');
      } catch {
        await fs.writeFile(groundTruthPath, `Ground truth diff unavailable. Pre: ${candidate.preFixHash}, Post: ${candidate.postFixHash}`, 'utf8');
      }
    } else if (candidate?.preFixHash && candidate?.postFixHash) {
      await fs.writeFile(groundTruthPath, `Sandbox unavailable. Pre: ${candidate.preFixHash}, Post: ${candidate.postFixHash}`, 'utf8');
    } else {
      await fs.writeFile(groundTruthPath, `Cannot generate ground-truth.diff for run ${runId}`, 'utf8');
    }

    return {
      runId: run.runId,
      candidateId: run.candidateId,
      agentId: run.agentId,
      regressionStatus: candidate ? 'regressed' : 'error',
      diffPatchPath,
      sessionLogPath,
      groundTruthPath,
      exportedAt: new Date(),
    };
  }

  async exportAllFailures(options?: { outputDir?: string }): Promise<FailureArtifact[]> {
    const runs = this.runResultRepo.getAll().filter(r => !r.metrics.success);
    const artifacts: FailureArtifact[] = [];
    for (const run of runs) {
      const artifact = await this.exportForRun(run.runId, options);
      artifacts.push(artifact);
    }
    return artifacts;
  }
}
