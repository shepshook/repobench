import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcCliDir = path.resolve(__dirname, '../../src/cli');
const srcConfigPath = path.resolve(__dirname, '../../src/core/config.ts');
const srcDbPersistencePath = path.resolve(__dirname, '../../src/infrastructure/persistence/database.ts');

/**
 * Integration tests for Task 2.6.2 Audit Feedback Round 3.
 *
 * These tests verify that:
 * 1. Legacy initDatabase() is completely removed from the codebase.
 * 2. ALL CLI entry points use resolveDatabasePath instead of raw fallback strings.
 * 3. The fallback default string only lives in config.ts (Zod default + resolveDatabasePath fallback).
 *
 * Architecture principle: §8.1 Explicit Environment — temp directories for import tests.
 * Source-level checks are used where dynamic imports can't verify static imports.
 */

describe('Task 2.6.2 — Legacy initDatabase() removal', () => {
  describe('initDatabase export must be removed', () => {
    it('should no longer export initDatabase from src/infrastructure/persistence/database.ts', async () => {
      const dbModule = await import('../../src/infrastructure/persistence/database');
      expect(dbModule.initDatabase).toBeUndefined();
    });

    it('should no longer export initDatabase from src/infrastructure/database.ts (re-export barrel)', async () => {
      const dbModule = await import('../../src/infrastructure/database');
      expect(dbModule.initDatabase).toBeUndefined();
    });
  });

  describe('initDatabase function definition must be absent from source', () => {
    it('persistence/database.ts must not contain "export function initDatabase"', () => {
      const content = fs.readFileSync(srcDbPersistencePath, 'utf-8');
      expect(content).not.toContain('export function initDatabase');
    });

    it('persistence/database.ts must not contain "export const initDatabase"', () => {
      const content = fs.readFileSync(srcDbPersistencePath, 'utf-8');
      expect(content).not.toContain('export const initDatabase');
    });

    it('persistence/database.ts must not contain "initDatabase = " assignment', () => {
      const content = fs.readFileSync(srcDbPersistencePath, 'utf-8');
      expect(content).not.toMatch(/initDatabase\s*=/);
    });

    it('persistence/database.ts must not contain "@deprecated Use Database.init() instead"', () => {
      const content = fs.readFileSync(srcDbPersistencePath, 'utf-8');
      expect(content).not.toContain('@deprecated');
    });
  });

  describe('bare "repobench.db" literal must not appear in CLI or database.ts', () => {
    const cliFiles = ['index.ts', 'evaluate.ts', 'run-all.ts', 'report.ts', 'export-failures.ts', 'mine.ts'];

    for (const file of cliFiles) {
      it(`${file} must not contain "?? resolveDatabasePath()" triple-fallback pattern`, () => {
        const content = fs.readFileSync(path.join(srcCliDir, file), 'utf-8');
        expect(content, `${file} must use canonical resolveDatabasePath(config.database?.path)`).not.toContain('?? resolveDatabasePath()');
      });
    }

    for (const file of cliFiles) {
      it(`${file} must not contain bare "'repobench.db'" fallback`, () => {
        const content = fs.readFileSync(path.join(srcCliDir, file), 'utf-8');
        expect(content, `${file} must not use 'repobench.db' fallback`).not.toContain("'repobench.db'");
      });
    }

    it('persistence/database.ts must not contain bare "repobench.db" default parameter', () => {
      const content = fs.readFileSync(srcDbPersistencePath, 'utf-8');
      expect(content).not.toContain("'repobench.db'");
    });
  });

  describe('CLI files must use resolveDatabasePath (no raw fallback)', () => {
    const cliFiles = ['index.ts', 'evaluate.ts', 'run-all.ts', 'report.ts', 'export-failures.ts'];

    for (const file of cliFiles) {
      it(`${file} must not contain "?? '~/.repobench/db/repobench.db'" fallback`, () => {
        const content = fs.readFileSync(path.join(srcCliDir, file), 'utf-8');
        expect(content, `${file} should not use raw fallback`).not.toContain("?? '~/.repobench/db/repobench.db'");
      });
    }

    const allCliFiles = ['index.ts', 'evaluate.ts', 'run-all.ts', 'report.ts', 'export-failures.ts', 'mine.ts'];

    for (const file of allCliFiles) {
      it(`${file} must import resolveDatabasePath from core/config`, () => {
        const content = fs.readFileSync(path.join(srcCliDir, file), 'utf-8');
        expect(content, `${file} must import resolveDatabasePath`).toContain('resolveDatabasePath');
      });
    }
  });

  describe('Fallback default path string location constraints', () => {
    it('config.ts must still contain the default path (Zod default + resolveDatabasePath fallback)', () => {
      const content = fs.readFileSync(srcConfigPath, 'utf-8');
      expect(content).toContain("~/.repobench/db/repobench.db");
    });

    it('persistence/database.ts must NOT contain the default path', () => {
      const content = fs.readFileSync(srcDbPersistencePath, 'utf-8');
      expect(content).not.toContain('~/.repobench/db/repobench.db');
    });

    it('no CLI file must contain the default path string', () => {
      const cliFiles = ['index.ts', 'evaluate.ts', 'run-all.ts', 'report.ts', 'export-failures.ts', 'mine.ts'];
      for (const file of cliFiles) {
        const content = fs.readFileSync(path.join(srcCliDir, file), 'utf-8');
        expect(content, `${file} must not contain ~/.repobench/db/repobench.db`).not.toContain('~/.repobench/db/repobench.db');
      }
    });
  });
});
