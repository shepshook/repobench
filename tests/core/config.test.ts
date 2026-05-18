import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadConfig } from '../../src/core/config';
import fs from 'node:fs/promises';

vi.mock('node:fs/promises');

describe('loadConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load a valid repobench.yaml', async () => {
    const mockConfig = `
mining:
  keywords: ['ai', 'ml']
  exclude_paths: ['node_modules/', '.git/']
  since: '2023-01-01T00:00:00Z'
  limit: 100
`;
    vi.mocked(fs.readFile).mockResolvedValue(mockConfig);

    const config = await loadConfig('repobench.yaml');

    expect(config).toEqual({
      mining: {
        keywords: ['ai', 'ml'],
        exclude_paths: ['node_modules/', '.git/'],
        since: '2023-01-01T00:00:00Z',
        limit: 100,
      },
    });
  });

  it('should throw a Zod error when YAML has invalid types', async () => {
    const mockInvalidConfig = `
mining:
  keywords: 'not-an-array'
  exclude_paths: ['node_modules/']
`;
    vi.mocked(fs.readFile).mockResolvedValue(mockInvalidConfig);

    await expect(loadConfig('repobench.yaml')).rejects.toThrow();
  });

  it('should return default configuration when file does not exist', async () => {
    const error = new Error('File not found');
    (error as any).code = 'ENOENT';
    vi.mocked(fs.readFile).mockRejectedValue(error);

    const config = await loadConfig('non-existent.yaml');

    expect(config).toEqual({
      mining: {
        keywords: [],
        exclude_paths: ['node_modules/', '.git/'],
        since: undefined,
        limit: undefined,
      },
    });
  });

  it('should load a valid sandbox configuration', async () => {
    const mockConfig = `
mining:
  keywords: ['ai']
  exclude_paths: []
sandbox:
  build_command: 'npm install'
  test_command: 'npm test'
  env_vars:
    NODE_ENV: 'test'
    API_KEY: 'secret'
`;
    vi.mocked(fs.readFile).mockResolvedValue(mockConfig);

    const config = await loadConfig('repobench.yaml');

    expect(config).toEqual({
      mining: {
        keywords: ['ai'],
        exclude_paths: [],
      },
      sandbox: {
        buildCommand: 'npm install',
        testCommand: 'npm test',
        envVars: {
          NODE_ENV: 'test',
          API_KEY: 'secret',
        },
      },
    });
  });

  it('should be backward compatible with configurations missing the sandbox section', async () => {
    const mockConfig = `
mining:
  keywords: ['ai']
  exclude_paths: []
`;
    vi.mocked(fs.readFile).mockResolvedValue(mockConfig);

    const config = await loadConfig('repobench.yaml');

    expect(config.sandbox).toBeUndefined();
    expect(config.mining).toBeDefined();
  });


  it('should load sandbox caching and base image configuration', async () => {
    const mockConfig = `
mining:
  keywords: ['ai']
  exclude_paths: []
sandbox:
  build_command: 'npm install'
  test_command: 'npm test'
  base_image: 'node:20-alpine'
  cache_paths: ['/root/.npm', 'node_modules']
`;
    vi.mocked(fs.readFile).mockResolvedValue(mockConfig);

    const config = await loadConfig('repobench.yaml');

    expect(config.sandbox).toEqual({
      buildCommand: 'npm install',
      testCommand: 'npm test',
      baseImage: 'node:20-alpine',
      cachePaths: ['/root/.npm', 'node_modules'],
    });
  });
});
