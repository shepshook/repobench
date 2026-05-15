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
});
