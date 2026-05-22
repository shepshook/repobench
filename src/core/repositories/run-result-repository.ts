import { db } from '../../infrastructure/persistence/database';
import { IRunResultRepository, RunResult } from '../contracts';

export class RunResultRepository implements IRunResultRepository {
  private saveStmt = db.prepare(`
    INSERT INTO runs (run_id, agent_id, candidate_id, success, cost, latency, e_score, timestamp, log_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(run_id) DO UPDATE SET
      agent_id = excluded.agent_id,
      candidate_id = excluded.candidate_id,
      success = excluded.success,
      cost = excluded.cost,
      latency = excluded.latency,
      e_score = excluded.e_score,
      timestamp = excluded.timestamp,
      log_path = excluded.log_path
  `);

  private getByIdStmt = db.prepare(`SELECT * FROM runs WHERE run_id = ?`);
  private getAllStmt = db.prepare(`SELECT * FROM runs`);
  private getByAgentIdStmt = db.prepare(`SELECT * FROM runs WHERE agent_id = ?`);
  private getByCandidateIdStmt = db.prepare(`SELECT * FROM runs WHERE candidate_id = ?`);

  private mapToEntity = (row: Record<string, unknown>): RunResult => {
    return {
      runId: row.runId as string,
      agentId: row.agentId as string,
      candidateId: row.candidateId as string,
      metrics: {
        success: Boolean(row.success),
        cost: row.cost as number,
        latency: row.latency as number,
        eScore: row.eScore as number,
      },
      timestamp: new Date(row.timestamp as string),
      logPath: row.logPath as string | undefined,
    };
  };

  save(run: RunResult): void {
    this.saveStmt.run(
      run.runId,
      run.agentId,
      run.candidateId,
      run.metrics.success ? 1 : 0,
      run.metrics.cost,
      run.metrics.latency,
      run.metrics.eScore,
      run.timestamp.toISOString(),
      run.logPath
    );
  }

  getById(runId: string): RunResult | undefined {
    const row = this.getByIdStmt.get(runId);
    return row ? this.mapToEntity(row) : undefined;
  }

  getAll(): RunResult[] {
    const rows = this.getAllStmt.all();
    return rows.map(this.mapToEntity);
  }

  getByAgentId(agentId: string): RunResult[] {
    const rows = this.getByAgentIdStmt.all(agentId);
    return rows.map(this.mapToEntity);
  }

  getByCandidateId(candidateId: string): RunResult[] {
    const rows = this.getByCandidateIdStmt.all(candidateId);
    return rows.map(this.mapToEntity);
  }
}
