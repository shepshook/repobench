import { ICandidateRepository, Candidate } from '../contracts.js';
import { db } from '../../infrastructure/persistence/database.js';

export class CandidateRepository implements ICandidateRepository {
  save(candidate: Candidate): void {
    const stmt = db.prepare(`
      INSERT INTO candidates (id, hash, message, files, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      candidate.id,
      candidate.hash,
      candidate.message,
      JSON.stringify(candidate.files),
      candidate.status,
      candidate.created_at.toISOString()
    );
  }

  exists(hash: string): boolean {
    const stmt = db.prepare('SELECT 1 FROM candidates WHERE hash = ?');
    const row = stmt.get(hash);
    return !!row;
  }

  getAll(): Candidate[] {
    const stmt = db.prepare('SELECT * FROM candidates');
    const rows = stmt.all() as any[];
    
    return rows.map(row => ({
      ...row,
      files: JSON.parse(row.files),
      created_at: new Date(row.created_at)
    }));
  }
}
