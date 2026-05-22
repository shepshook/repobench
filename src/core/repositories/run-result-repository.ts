import { IRunResultRepository, RunResult, IDatabase } from '../contracts';

type PreparedStmt<T> = {
  get(...params: unknown[]): T | undefined;
  all(...params: unknown[]): T[];
  run(...params: unknown[]): { changes: number; lastInsertRowid: number };
};

export class RunResultRepository implements IRunResultRepository {
  private saveStmt: PreparedStmt<Record<string, unknown>>;
  private getByIdStmt: PreparedStmt<Record<string, unknown>>;
  private getAllStmt: PreparedStmt<Record<string, unknown>>;
  private getByAgentIdStmt: PreparedStmt<Record<string, unknown>>;
  private getByCandidateIdStmt: PreparedStmt<Record<string, unknown>>;

  constructor(database: IDatabase) {
    this.saveStmt = database.prepare<Record<string, unknown>>(`
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

    this.getByIdStmt = database.prepare<Record<string, unknown>>(`SELECT * FROM runs WHERE run_id = ?`);
    this.getAllStmt = database.prepare<Record<string, unknown>>(`SELECT * FROM runs`);
    this.getByAgentIdStmt = database.prepare<Record<string, unknown>>(`SELECT * FROM runs WHERE agent_id = ?`);
    this.getByCandidateIdStmt = database.prepare<Record<string, unknown>>(`SELECT * FROM runs WHERE candidate_id = ?`);
  }

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
