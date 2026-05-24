import DatabaseConstructor from 'better-sqlite3';
import path from 'path';
import type { IDatabase } from '../../core/contracts';

let _rawDb: DatabaseConstructor.Database | null = null;
let _rawDbOrigin: 'init' | 'reinit' | null = null;

export const getRawDb = () => {
  if (!_rawDb) throw new Error('Database not initialized');
  return _rawDb;
};

export function reinitDatabase(dbPath: string): void {
  _rawDbOrigin = 'reinit';
  if (_rawDb) {
    _rawDb.close();
  }
  _rawDb = new DatabaseConstructor(dbPath);
  initDatabaseInternal();
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

function ensureRawDb(): DatabaseConstructor.Database {
  if (!_rawDb) {
    throw new Error('Database not initialized. Call Database.init() or reinitDatabase() first.');
  }
  return _rawDb;
}

export const db = {
  prepare: <T = Record<string, unknown>>(sql: string): TypedStatement<T> => {
      const stmt = ensureRawDb().prepare(sql);
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
    ensureRawDb().prepare(sql).run(...params) as { changes: number; lastInsertRowid: number },
};

function initDatabaseInternal(): void {
  const raw = ensureRawDb();
  try {
    raw.prepare(`
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
    raw.prepare(`
      CREATE TABLE IF NOT EXISTS containers (
        container_id TEXT PRIMARY KEY,
        image TEXT,
        created_at TEXT,
        status TEXT,
        labels TEXT
      )
    `).run();
    raw.prepare(`
      CREATE TABLE IF NOT EXISTS runs (
        run_id TEXT PRIMARY KEY NOT NULL,
        agent_id TEXT NOT NULL,
        candidate_id TEXT NOT NULL,
        success INTEGER NOT NULL,
        cost REAL NOT NULL,
        latency REAL NOT NULL,
        e_score REAL NOT NULL,
        timestamp TEXT NOT NULL,
        log_path TEXT
      )
    `).run();
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}
export class Database {
  static init(options: { dbPath: string }): IDatabase {
    if (!options || !options.dbPath || options.dbPath.trim() === '') {
      throw new Error('dbPath is required');
    }
    const resolvedPath = path.resolve(options.dbPath);
    if (_rawDb) {
      if (_rawDbOrigin === 'init' || _rawDb.name !== resolvedPath) {
        reinitDatabase(resolvedPath);
        _rawDbOrigin = 'init';
      }
      return db;
    }
    reinitDatabase(resolvedPath);
    _rawDbOrigin = 'init';
    return db;
  }
}

