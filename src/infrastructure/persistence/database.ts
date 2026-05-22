import Database from 'better-sqlite3';
import path from 'path';

let dbPath = process.env.REPOBENCH_DB_PATH || path.resolve(process.cwd(), 'repobench.db');
let _rawDb = new Database(dbPath);

export const getRawDb = () => _rawDb;

export function reinitDatabase(newDbPath?: string): void {
  _rawDb.close();
  if (newDbPath) {
    dbPath = newDbPath;
  }
  _rawDb = new Database(dbPath);
  initDatabase();
}

function snakeToCamel(str: string) {
  return str.replace(/(_[a-z])/g, (group) =>
    group.toUpperCase().replace('_', '')
  );
}

interface TypedStatement<T> {
  get(...params: unknown[]): T | undefined;
  all(...params: unknown[]): T[];
  run(...params: unknown[]): { changes: number; lastInsertRowid: number };
}

export const db = {
  prepare: <T = Record<string, unknown>>(sql: string): TypedStatement<T> => {
      const stmt = _rawDb.prepare(sql);
      const wrapResult = (result: unknown): T | T[] | undefined => {
        if (!result) return result as undefined;
        if (Array.isArray(result)) {
          return result.map((row: Record<string, unknown>) => {
            const newRow: Record<string, unknown> = {};
            for (const key in row) {
              newRow[snakeToCamel(key)] = row[key];
            }
            return newRow as T;
          });
        }
        const row = result as Record<string, unknown>;
        const newRow: Record<string, unknown> = {};
        for (const key in row) {
          newRow[snakeToCamel(key)] = row[key];
        }
        return newRow as T;
      };
      return {
        get: (...params: unknown[]): T | undefined => wrapResult(stmt.get(...params)) as T | undefined,
        all: (...params: unknown[]): T[] => wrapResult(stmt.all(...params)) as T[],
        run: (...params: unknown[]): { changes: number; lastInsertRowid: number } =>
          stmt.run(...params) as { changes: number; lastInsertRowid: number },
      };
  },
  run: (sql: string, ...params: unknown[]): { changes: number; lastInsertRowid: number } =>
    _rawDb.prepare(sql).run(...params) as { changes: number; lastInsertRowid: number },
};

/**
 * Initializes the database schema.
 * Creates the candidates table if it does not exist.
 */
export function initDatabase(newDbPath?: string): void {
  if (newDbPath) {
    reinitDatabase(newDbPath);
    return;
  }
  try {
    _rawDb.prepare(`
      CREATE TABLE IF NOT EXISTS candidates (
        id TEXT PRIMARY KEY,
        hash TEXT NOT NULL,
        message TEXT NOT NULL,
        files TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        repository_url TEXT,
        repository_name TEXT,
        pre_fix_hash TEXT,
        post_fix_hash TEXT,
        curation_score REAL,
        curation_reasoning TEXT,
        curation_is_approved INTEGER,
        curation_raw_response TEXT
      )
    `).run();
    _rawDb.prepare(`
      CREATE TABLE IF NOT EXISTS containers (
        container_id TEXT PRIMARY KEY,
        image TEXT,
        created_at TEXT,
        status TEXT,
        labels TEXT
      )
    `).run();
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

// Initialize database schema on load
initDatabase();

