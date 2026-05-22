import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/core/config.js';
import path from 'node:path';

describe('repobench.yaml (Task 1.7.2)', () => {
  it('should contain the exact spec values from task-1.7.2', async () => {
    const configPath = path.resolve(process.cwd(), 'repobench.yaml');
    const config = await loadConfig(configPath);

    expect(config.mining.keywords).toEqual(
      expect.arrayContaining(['fix', 'bug', 'error', 'issue', 'patch']),
    );

    expect(config.mining.exclude_paths).toEqual(
      expect.arrayContaining(['node_modules/', '.git/', 'dist/']),
    );

    expect(config.mining.since).toBe('2025-01-01T00:00:00Z');

    expect(config.sandbox).toBeDefined();
    expect(config.sandbox!.buildCommand).toBe('npm ci');
    expect(config.sandbox!.testCommand).toBe('npm test');
    expect(config.sandbox!.baseImage).toBe('node:20-alpine');
  });
});
