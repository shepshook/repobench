import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { ICandidateRepository, CommitCandidate } from '../../types/contracts';

interface CandidateRow {
  hash: string;
  message: string;
  files: string;
  status: string;
  metadata: string;
}

export class SqliteCandidateRepository implements ICandidateRepository {
  private db: Database.Database;
  private readonly dbPath = '.repobench/candidates.db';

  constructor() {
    this.ensureDirectoryExists();
    this.db = new Database(this.dbPath);
    this.init();
  }

  private ensureDirectoryExists(): void {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS candidates (
        hash TEXT PRIMARY KEY,
        message TEXT,
        files TEXT,
        status TEXT,
        metadata TEXT
      )
    `);
  }

  async saveMany(candidates: CommitCandidate[]): Promise<void> {
    const insert = this.db.prepare(
      'INSERT OR REPLACE INTO candidates (hash, message, files, status, metadata) VALUES (?, ?, ?, ?, ?)'
    );

    const transaction = this.db.transaction((candidatesToSave: CommitCandidate[]) => {
      for (const c of candidatesToSave) {
        insert.run(
          c.hash,
          c.message,
          JSON.stringify(c.files),
          c.status,
          JSON.stringify(c.metadata || {})
        );
      }
    });

    transaction(candidates);
  }

  async findAll(): Promise<CommitCandidate[]> {
    const stmt = this.db.prepare('SELECT * FROM candidates');
    const rows = stmt.all() as CandidateRow[];

    return rows.map(row => ({
      hash: row.hash,
      message: row.message,
      files: JSON.parse(row.files),
      status: row.status as CommitCandidate['status'],
      metadata: JSON.parse(row.metadata),
    }));
  }

  async findByStatus(status: CommitCandidate['status']): Promise<CommitCandidate[]> {
    const stmt = this.db.prepare('SELECT * FROM candidates WHERE status = ?');
    const rows = stmt.all(status) as CandidateRow[];

    return rows.map(row => ({
      hash: row.hash,
      message: row.message,
      files: JSON.parse(row.files),
      status: row.status as CommitCandidate['status'],
      metadata: JSON.parse(row.metadata),
    }));
  }

  async updateStatus(hash: string, status: CommitCandidate['status']): Promise<void> {
    const stmt = this.db.prepare('UPDATE candidates SET status = ? WHERE hash = ?');
    stmt.run(status, hash);
  }

  async updateStatuses(updates: {hash: string, status: CommitCandidate['status']}[]): Promise<void> {
    const stmt = this.db.prepare('UPDATE candidates SET status = ? WHERE hash = ?');
    this.db.transaction(() => {
      for (const update of updates) {
        stmt.run(update.status, update.hash);
      }
    })();
  }

  async findByHashes(hashes: string[]): Promise<CommitCandidate[]> {
    if (hashes.length === 0) return [];
    const placeholders = hashes.map(() => '?').join(',');
    const stmt = this.db.prepare(`SELECT * FROM candidates WHERE hash IN (${placeholders})`);
    const rows = stmt.all(hashes) as any[];

    return rows.map(row => ({
      hash: row.hash,
      message: row.message,
      files: JSON.parse(row.files),
      status: row.status as CommitCandidate['status'],
      metadata: JSON.parse(row.metadata),
    }));
  }

  async clear(): Promise<void> {
    this.db.prepare('DELETE FROM candidates').run();
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
