import Database from 'better-sqlite3';
import path from 'path';

// Database located in the root directory
const dbPath = path.resolve(process.cwd(), 'repobench.db');

export const db = new Database(dbPath);

/**
 * Initializes the database schema.
 * Creates the candidates table if it does not exist.
 */
export function initDatabase(): void {
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS candidates (
        id TEXT PRIMARY KEY,
        hash TEXT NOT NULL UNIQUE,
        message TEXT NOT NULL,
        files TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `).run();
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}
