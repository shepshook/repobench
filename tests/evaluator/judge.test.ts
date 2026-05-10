import { describe, it, expect, beforeAll } from 'vitest';
import { Judge } from '../../src/evaluator/judge';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

describe('Judge', () => {
  const tmpDir = path.join(os.tmpdir(), 'repobench-judge-tests');
  
  beforeAll(() => {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
  });

  it('should correctly identify a failing test', () => {
    const file = path.join(tmpDir, 'fail.js');
    fs.writeFileSync(file, 'process.exit(1)');
    
    const result = Judge.runTest(tmpDir, `node ${file}`);
    expect(result.passed).toBe(false);
    expect(result.exitCode).toBe(1);
  });

  it('should correctly identify a passing test', () => {
    const file = path.join(tmpDir, 'pass.js');
    fs.writeFileSync(file, 'process.exit(0)');
    
    const result = Judge.runTest(tmpDir, `node ${file}`);
    expect(result.passed).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  it('should verify a fix correctly', () => {
    const preFixDir = path.join(tmpDir, 'pre');
    const postFixDir = path.join(tmpDir, 'post');
    fs.mkdirSync(preFixDir, { recursive: true });
    fs.mkdirSync(postFixDir, { recursive: true });

    fs.writeFileSync(path.join(preFixDir, 'test.js'), 'process.exit(1)');
    fs.writeFileSync(path.join(postFixDir, 'test.js'), 'process.exit(0)');

    const verified = Judge.verifyFix(preFixDir, postFixDir, 'node test.js');
    expect(verified).toBe(true);
  });
});
