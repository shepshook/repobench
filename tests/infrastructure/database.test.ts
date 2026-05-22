import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { reinitDatabase, db } from '../../src/infrastructure/persistence/database';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

describe('Database Schema', () => {
  let tempDbPath: string;

  beforeEach(async () => {
    tempDbPath = path.join(os.tmpdir(), `db-schema-test-${Date.now()}-${Math.random()}.db`);
    await reinitDatabase(tempDbPath);
  });

  afterEach(async () => {
    try {
      await fs.unlink(tempDbPath);
    } catch {}
  });

  it('should create the runs table with the correct schema', () => {
    const tableInfo = db.prepare('PRAGMA table_info(runs)').all();
    
    expect(tableInfo).toBeDefined();
    expect(tableInfo.length).toBe(9);

    const columns = tableInfo.map(col => ({
      name: col.name,
      type: col.type,
      notnull: col.notnull,
      pk: col.pk
    }));

    const expectedColumns = [
      { name: 'run_id', type: 'TEXT', notnull: 1, pk: 1 },
      { name: 'agent_id', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'candidate_id', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'success', type: 'INTEGER', notnull: 1, pk: 0 },
      { name: 'cost', type: 'REAL', notnull: 1, pk: 0 },
      { name: 'latency', type: 'REAL', notnull: 1, pk: 0 },
      { name: 'e_score', type: 'REAL', notnull: 1, pk: 0 },
      { name: 'timestamp', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'log_path', type: 'TEXT', notnull: 0, pk: 0 },
    ];

    expectedColumns.forEach((expected, index) => {
      expect(columns[index]).toEqual(expected);
    });
  });

  it('should not have a unique constraint on (agent_id, candidate_id)', () => {
    const indexInfo = db.prepare('PRAGMA index_list(runs)').all();
    
    // Filter for indices that might be UNIQUE
    const uniqueIndices = indexInfo.filter(idx => idx.unique === 1);
    
    // The only unique index should be the primary key if it's explicitly created as an index, 
    // but normally PK is handled separately or as a unique index.
    // We want to make sure there's no UNIQUE(agent_id, candidate_id)
    
    for (const idx of uniqueIndices) {
      const idxInfo = db.prepare(`PRAGMA index_info(${idx.name})`).all();
      const cols = idxInfo.map(info => info.name);
      
      const isAgentCandidateUnique = cols.includes('agent_id') && cols.includes('candidate_id');
      expect(isAgentCandidateUnique).toBe(false);
    }
  });
});
