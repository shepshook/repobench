# Task 5.1.2: SQLite Schema for Run Results

## Context
- Module: `src/infrastructure/persistence/database.ts`
- Requirement: Feature 5.1 (Results Persistence Layer)
- Goal: Add `runs` table to the database schema.

## Technical Directive
1. Extend the `initDatabase()` function in `src/infrastructure/persistence/database.ts`.
2. Add a `CREATE TABLE IF NOT EXISTS runs (...)` statement with columns matching `RunResult`:
   - `run_id TEXT PRIMARY KEY`
   - `agent_id TEXT NOT NULL`
   - `candidate_id TEXT NOT NULL`
   - `success INTEGER NOT NULL` (boolean stored as 0/1)
   - `cost REAL NOT NULL`
   - `latency REAL NOT NULL`
   - `e_score REAL NOT NULL`
   - `timestamp TEXT NOT NULL`
   - `log_path TEXT`
3. Do NOT add a UNIQUE constraint on `(agent_id, candidate_id)` — the same agent may re-evaluate the same candidate. `run_id` is the sole primary key.
4. Note: `RunResult.timestamp` is `z.date()` in the Zod schema. The repository must convert JavaScript `Date` ↔ ISO8601 `TEXT` for SQLite compatibility, consistent with the existing `candidates` table pattern (`created_at TEXT` → `new Date(row.createdAt)`).

## DoD
- `runs` table is created on `initDatabase()`.
- Schema supports querying by agent or candidate.
