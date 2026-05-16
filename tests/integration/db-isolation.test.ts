import { describe, it, expect } from 'vitest';
import { reinitDatabase, getRawDb } from '../../src/infrastructure/persistence/database';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

describe('Database Isolation Test', () => {
  it('should provide isolation when calling initDatabase with different paths (this is the buggy behavior)', async () => {
    const dbPath1 = path.join(os.tmpdir(), `isolation-test-1-${Date.now()}.db`);
    const dbPath2 = path.join(os.tmpdir(), `isolation-test-2-${Date.now()}.db`);

    // Simulate Test 1
    reinitDatabase(dbPath1);
    getRawDb().prepare('INSERT INTO candidates (id, hash, message, files, status, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      'test-1', 'hash-1', 'message-1', '[]', 'validated', new Date().toISOString()
    );

    // Simulate Test 2
    reinitDatabase(dbPath2);
    const count = getRawDb().prepare('SELECT COUNT(*) as count FROM candidates').get() as { count: number };
    
    // If isolation works, count should be 0 because it's a "new" database.
    // If isolation fails (current behavior), count will be 1 because both used the default DB.
    expect(count.count).toBe(0);

    // Cleanup
    try {
      await fs.unlink(dbPath1);
      await fs.unlink(dbPath2);
    } catch {}
  });
});
