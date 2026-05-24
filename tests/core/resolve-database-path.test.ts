import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveDatabasePath } from '../../src/core/config';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

describe('resolveDatabasePath', () => {
  beforeEach(() => {
    vi.spyOn(os, 'homedir').mockReturnValue('/home/testuser');
    vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
  });

  it('should default to ~/.repobench/db/repobench.db expanded to home directory', () => {
    const result = resolveDatabasePath();

    expect(result).toBe('/home/testuser/.repobench/db/repobench.db');
    expect(fs.mkdirSync).toHaveBeenCalledWith(
      '/home/testuser/.repobench/db',
      { recursive: true },
    );
  });

  it('should use absolute path override as-is', () => {
    const result = resolveDatabasePath('/custom/path/database.db');

    expect(result).toBe('/custom/path/database.db');
    expect(fs.mkdirSync).toHaveBeenCalledWith('/custom/path', { recursive: true });
  });

  it('should resolve relative paths against the project root', () => {
    const cwd = process.cwd();
    const result = resolveDatabasePath('relative/path/db.sqlite');

    const expected = path.resolve(cwd, 'relative', 'path', 'db.sqlite');
    expect(result).toBe(expected);
    expect(fs.mkdirSync).toHaveBeenCalledWith(
      path.resolve(cwd, 'relative', 'path'),
      { recursive: true },
    );
  });

  it('should create parent directory when it does not exist', () => {
    resolveDatabasePath('/tmp/nonexistent/dir/test.db');

    expect(fs.mkdirSync).toHaveBeenCalledTimes(1);
    expect(fs.mkdirSync).toHaveBeenCalledWith(
      '/tmp/nonexistent/dir',
      { recursive: true },
    );
  });
});



describe('resolveDatabasePath — edge cases (cross-platform safe)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(os, 'homedir').mockReturnValue('/home/testuser');
    vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
  });

  it('should fall back to CWD when no project markers exist in any ancestor', () => {
    const testDir = path.resolve('/tmp/no-markers-dir');
    vi.spyOn(process, 'cwd').mockReturnValue(testDir);
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const result = resolveDatabasePath('relative/data.db');

    const expected = path.resolve(testDir, 'relative', 'data.db');
    expect(result).toBe(expected);
    expect(fs.mkdirSync).toHaveBeenCalledWith(
      path.dirname(expected),
      { recursive: true },
    );
  });

  it('should use default path when configPath is empty string', () => {
    const result = resolveDatabasePath('');
    const home = os.homedir();

    const expected = home + '/.repobench/db/repobench.db';
    expect(result).toBe(expected);
    expect(fs.mkdirSync).toHaveBeenCalledWith(
      home + '/.repobench/db',
      { recursive: true },
    );
  });

  it('should not throw when mkdirSync parent directory already exists (idempotent)', () => {
    vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);

    expect(() => {
      resolveDatabasePath('/tmp/existing/db.sqlite');
      resolveDatabasePath('/tmp/existing/db.sqlite');
    }).not.toThrow();

    expect(fs.mkdirSync).toHaveBeenCalledTimes(2);
  });

  it('should preserve native path separators in tilde expansion (no forced forward slashes)', () => {
    vi.spyOn(os, 'homedir').mockReturnValue('C:\\Users\\testuser');

    const result = resolveDatabasePath();

    expect(result).toBe('C:\\Users\\testuser\\.repobench\\db\\repobench.db');
  });
});

describe('resolveDatabasePath — real filesystem (ARCHITECTURE §8.1 temp dirs)', () => {
  let tmpDir: string;
  let homeDir: string;

  beforeEach(() => {
    vi.restoreAllMocks();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repobench-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('should detect project root by walking up with actual package.json on disk', () => {
    const subDir = path.join(tmpDir, 'src', 'subdir', 'deep');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}', 'utf8');
    vi.spyOn(process, 'cwd').mockReturnValue(subDir);
    vi.spyOn(os, 'homedir').mockReturnValue(path.join(tmpDir, 'home'));
    vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);

    const result = resolveDatabasePath('data/repobench.db');

    const expected = path.resolve(tmpDir, 'data', 'repobench.db');
    expect(result).toBe(expected);
    expect(fs.mkdirSync).toHaveBeenCalledWith(
      path.dirname(expected),
      { recursive: true },
    );
  });

  it('should detect repobench.yaml marker when package.json is absent', () => {
    const subDir = path.join(tmpDir, 'nested', 'subdir');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'repobench.yaml'), '', 'utf8');
    vi.spyOn(process, 'cwd').mockReturnValue(subDir);
    vi.spyOn(os, 'homedir').mockReturnValue(path.join(tmpDir, 'home'));
    vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);

    const result = resolveDatabasePath('db/test.db');

    const expected = path.resolve(tmpDir, 'db', 'test.db');
    expect(result).toBe(expected);
  });

  it('should return native path separators for relative path resolution (no forward-slash coercion)', () => {
    const subDir = path.join(tmpDir, 'deeply', 'nested');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}', 'utf8');
    vi.spyOn(process, 'cwd').mockReturnValue(subDir);
    vi.spyOn(os, 'homedir').mockReturnValue(path.join(tmpDir, 'home'));
    vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);

    const result = resolveDatabasePath('nested/db.sqlite');

    expect(result).toBe(path.resolve(tmpDir, 'nested', 'db.sqlite'));
    expect(result).not.toContain('/');
  });

  it('should stop at the first marker found (nearest ancestor wins)', () => {
    const inner = path.join(tmpDir, 'inner');
    fs.mkdirSync(inner, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}', 'utf8');
    fs.writeFileSync(path.join(inner, 'repobench.yaml'), '', 'utf8');
    vi.spyOn(process, 'cwd').mockReturnValue(inner);
    vi.spyOn(os, 'homedir').mockReturnValue(path.join(tmpDir, 'home'));
    vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);

    const result = resolveDatabasePath('data/db.sqlite');

    const expected = path.resolve(inner, 'data', 'db.sqlite');
    expect(result).toBe(expected);
  });

  it('should walk up through multiple directory levels to find the project root', () => {
    const deepPath = path.join(tmpDir, 'a', 'b', 'c', 'd', 'e');
    fs.mkdirSync(deepPath, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}', 'utf8');
    vi.spyOn(process, 'cwd').mockReturnValue(deepPath);
    vi.spyOn(os, 'homedir').mockReturnValue(path.join(tmpDir, 'home'));
    vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);

    const result = resolveDatabasePath('relative/path.db');

    const expected = path.resolve(tmpDir, 'relative', 'path.db');
    expect(result).toBe(expected);
  });
});
