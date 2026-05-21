import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';

describe('SQLite Bindings', () => {
  it('should be able to instantiate a better-sqlite3 database', () => {
    const db = new Database(':memory:');
    expect(db).toBeDefined();
    db.close();
  });
});
