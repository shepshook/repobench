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

  it('should throw when YAML has invalid syntax', async () => {
    const invalidYaml = `
mining:
  keywords: [fix
  exclude_paths: []
`;
    vi.mocked(fs.readFile).mockResolvedValue(invalidYaml);

    await expect(loadConfig('repobench.yaml')).rejects.toThrow();
  });

  it('should throw when YAML file is empty (null parsed)', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('');

    await expect(loadConfig('repobench.yaml')).rejects.toThrow();
  });

  it('should re-throw non-ENOENT filesystem errors', async () => {
    const permissionError = new Error('EACCES: permission denied');
    (permissionError as any).code = 'EACCES';
    vi.mocked(fs.readFile).mockRejectedValue(permissionError);

    await expect(loadConfig('repobench.yaml')).rejects.toThrow('EACCES');
  });

  it('should default to repobench.yaml when no path is given', async () => {
    const mockConfig = `
mining:
  keywords: ['fix']
  exclude_paths: []
`;
    vi.mocked(fs.readFile).mockResolvedValue(mockConfig);

    const config = await loadConfig();

    expect(config.mining.keywords).toEqual(['fix']);
    expect(vi.mocked(fs.readFile)).toHaveBeenCalledWith('repobench.yaml', 'utf8');
  });

  it('should load a config with the curation section', async () => {
    const mockConfig = `
mining:
  keywords: ['fix', 'bug']
  exclude_paths: ['node_modules/']
curation:
  prompt: 'Evaluate this fix for correctness and style'
`;
    vi.mocked(fs.readFile).mockResolvedValue(mockConfig);

    const config = await loadConfig('repobench.yaml');

    expect(config.curation).toBeDefined();
    expect(config.curation!.prompt).toBe('Evaluate this fix for correctness and style');
    expect(config.mining.keywords).toEqual(['fix', 'bug']);
  });

  it('should load a config with mining.limit', async () => {
    const mockConfig = `
mining:
  keywords: ['fix', 'bug']
  exclude_paths: ['node_modules/']
  limit: 50
`;
    vi.mocked(fs.readFile).mockResolvedValue(mockConfig);

    const config = await loadConfig('repobench.yaml');

    expect(config.mining.limit).toBe(50);
  });

  it('should reject invalid ISO datetime in mining.since', async () => {
    const mockConfig = `
mining:
  keywords: ['fix']
  exclude_paths: []
  since: 'not-a-datetime'
`;
    vi.mocked(fs.readFile).mockResolvedValue(mockConfig);

    await expect(loadConfig('repobench.yaml')).rejects.toThrow();
  });

  it('should accept extra unknown fields in YAML without throwing', async () => {
    const mockConfig = `
mining:
  keywords: ['fix']
  exclude_paths: []
unknown_field: 'should-not-break'
extra:
  nested: value
`;
    vi.mocked(fs.readFile).mockResolvedValue(mockConfig);

    const config = await loadConfig('repobench.yaml');

    expect(config.mining.keywords).toEqual(['fix']);
  });

  it('should load a config with all sections fully populated', async () => {
    const mockConfig = `
mining:
  keywords: ['fix', 'bug', 'error']
  exclude_paths: ['node_modules/', '.git/', 'dist/']
  since: '2025-01-01T00:00:00Z'
  limit: 100
curation:
  prompt: 'Evaluate this fix'
sandbox:
  build_command: 'npm ci'
  test_command: 'npm test'
  base_image: 'node:20-alpine'
  env_vars:
    NODE_ENV: 'test'
  cache_paths: ['/root/.npm', 'node_modules']
`;
    vi.mocked(fs.readFile).mockResolvedValue(mockConfig);

    const config = await loadConfig('repobench.yaml');

    expect(config.mining.keywords).toEqual(['fix', 'bug', 'error']);
    expect(config.mining.exclude_paths).toEqual(['node_modules/', '.git/', 'dist/']);
    expect(config.mining.since).toBe('2025-01-01T00:00:00Z');
    expect(config.mining.limit).toBe(100);
    expect(config.curation).toBeDefined();
    expect(config.curation!.prompt).toBe('Evaluate this fix');
    expect(config.sandbox).toBeDefined();
    expect(config.sandbox!.buildCommand).toBe('npm ci');
    expect(config.sandbox!.testCommand).toBe('npm test');
    expect(config.sandbox!.baseImage).toBe('node:20-alpine');
    expect(config.sandbox!.envVars).toEqual({ NODE_ENV: 'test' });
    expect(config.sandbox!.cachePaths).toEqual(['/root/.npm', 'node_modules']);
  });
});
