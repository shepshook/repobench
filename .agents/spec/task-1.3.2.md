# Task 1.3.2: SQLite Infrastructure Setup

## Context
- Module: `infrastructure/persistence`
- Requirement: Feature 1.3
- Goal: Setup `better-sqlite3` and database schema.

## Technical Directive
1. Create `src/infrastructure/persistence/database.ts`.
2. Initialize `better-sqlite3` connection.
3. Implement `initDatabase()`:
   - `CREATE TABLE IF NOT EXISTS candidates (...)`
   - Use `UNIQUE` constraint on `commit_hash`.

## DoD
- Database initializes properly.
- Table schema includes `UNIQUE` constraint.
