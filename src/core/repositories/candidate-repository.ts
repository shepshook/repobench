import { ICandidateRepository, Candidate } from '../contracts.js';
import { db, getRawDb } from '../../infrastructure/persistence/database.js';

export class CandidateRepository implements ICandidateRepository {
  save(candidate: Candidate): void {
    const rawDb = getRawDb();
    const stmt = rawDb.prepare(`
      INSERT INTO candidates (id, hash, message, files, status, created_at, repository_url, repository_name, pre_fix_hash, post_fix_hash, curation_score, curation_reasoning, curation_is_approved, curation_raw_response)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        hash = excluded.hash,
        message = excluded.message,
        files = excluded.files,
        status = excluded.status,
        created_at = excluded.created_at,
        repository_url = excluded.repository_url,
        repository_name = excluded.repository_name,
        pre_fix_hash = excluded.pre_fix_hash,
        post_fix_hash = excluded.post_fix_hash,
        curation_score = excluded.curation_score,
        curation_reasoning = excluded.curation_reasoning,
        curation_is_approved = excluded.curation_is_approved,
        curation_raw_response = excluded.curation_raw_response
    `);
    
    stmt.run(
      candidate.id,
      candidate.hash,
      candidate.message,
      JSON.stringify(candidate.files),
      candidate.status,
      candidate.created_at.toISOString(),
      candidate.repositoryUrl,
      candidate.repositoryName,
      candidate.preFixHash,
      candidate.postFixHash,
      candidate.curation?.score,
      candidate.curation?.reasoning,
      candidate.curation ? (candidate.curation.isApproved ? 1 : 0) : null,
      candidate.curation?.rawResponse
    );
  }

  upsert(candidate: Candidate): void {
    this.save(candidate);
  }
  
  exists(hash: string): boolean {
    const stmt = db.prepare('SELECT 1 FROM candidates WHERE hash = ?');
    const row = stmt.get(hash);
    return !!row;
  }
  
  existsById(id: string): boolean {
    const stmt = db.prepare('SELECT 1 FROM candidates WHERE id = ?');
    const row = stmt.get(id);
    return !!row;
  }
  
  getById(id: string): Candidate | undefined {
    const stmt = db.prepare('SELECT * FROM candidates WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return undefined;
    
    const candidate: Candidate = {
      id: row.id,
      hash: row.hash,
      message: row.message,
      files: JSON.parse(row.files),
      status: row.status,
      created_at: new Date(row.createdAt),
      repositoryUrl: row.repositoryUrl,
      repositoryName: row.repositoryName,
    };

    if (row.preFixHash) candidate.preFixHash = row.preFixHash;
    if (row.postFixHash) candidate.postFixHash = row.postFixHash;
    if (row.curationIsApproved !== null || row.curationScore !== null) {
      candidate.curation = {
        score: row.curationScore,
        reasoning: row.curationReasoning,
        isApproved: !!row.curationIsApproved,
        rawResponse: row.curationRawResponse,
      };
    }

    return candidate;
  }

  getAll(): Candidate[] {
    const stmt = db.prepare('SELECT * FROM candidates');
    const rows = stmt.all() as any[];
    
    return rows.map(row => {
      const candidate: Candidate = {
        id: row.id,
        hash: row.hash,
        message: row.message,
        files: JSON.parse(row.files),
        status: row.status,
        created_at: new Date(row.createdAt),
        repositoryUrl: row.repositoryUrl,
        repositoryName: row.repositoryName,
      };

      if (row.preFixHash) candidate.preFixHash = row.preFixHash;
      if (row.postFixHash) candidate.postFixHash = row.postFixHash;
      if (row.curationIsApproved !== null || row.curationScore !== null) {
        candidate.curation = {
          score: row.curationScore,
          reasoning: row.curationReasoning,
          isApproved: !!row.curationIsApproved,
          rawResponse: row.curationRawResponse,
        };
      }

      return candidate;
    });
  }
}
