import { describe, it, expect, beforeEach } from 'vitest';
import { reinitDatabase, getRawDb } from '../../src/infrastructure/persistence/database';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

describe('Database Isolation', () => {
  it('should maintain isolation between concurrent tests using different DB paths', async () => {
    const tempDbPath = path.join(os.tmpdir(), `isolation-test-${Math.random()}.db`);
    await reinitDatabase(tempDbPath);
    
    const db = getRawDb();
    db.prepare('INSERT INTO candidates (id, hash, message, files, status, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      'test-id', 'hash', 'msg', 'files', 'pending', new Date().toISOString()
    );
    
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const result = db.prepare('SELECT count(*) as count FROM candidates').get();
    expect(result.count).toBe(1);
    
    await fs.unlink(tempDbPath).catch(() => {});
  });

  it('should maintain isolation between concurrent tests using different DB paths 2', async () => {
    const tempDbPath = path.join(os.tmpdir(), `isolation-test-2-${Math.random()}.db`);
    await reinitDatabase(tempDbPath);
    
    const db = getRawDb();
    db.prepare('INSERT INTO candidates (id, hash, message, files, status, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      'test-id-2', 'hash', 'msg', 'files', 'pending', new Date().toISOString()
    );
    
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const result = db.prepare('SELECT count(*) as count FROM candidates').get();
    expect(result.count).toBe(1);
    
    await fs.unlink(tempDbPath).catch(() => {});
  });
});
