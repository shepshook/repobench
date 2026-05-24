import { describe, it, expect } from 'vitest';
import { RepoBenchConfigSchema } from '../../src/core/config';

describe('RepoBenchConfigSchema', () => {
  it('should accept a config with curation section and prompt', () => {
    const result = RepoBenchConfigSchema.parse({
      mining: {
        keywords: ['fix', 'bug'],
        exclude_paths: ['node_modules/'],
      },
      curation: {
        prompt: 'Evaluate the quality of this fix',
      },
    });
    expect(result.curation).toEqual({ prompt: 'Evaluate the quality of this fix' });
  });

  it('should accept a config with curation section but no prompt', () => {
    const result = RepoBenchConfigSchema.parse({
      mining: {
        keywords: ['fix'],
        exclude_paths: [],
      },
      curation: {},
    });
    expect(result.curation).toEqual({});
  });

  it('should load limit as a number', () => {
    const result = RepoBenchConfigSchema.parse({
      mining: {
        keywords: ['fix'],
        exclude_paths: [],
        limit: 50,
      },
    });
    expect(result.mining.limit).toBe(50);
  });

  it('should reject missing mining section', () => {
    expect(() => RepoBenchConfigSchema.parse({})).toThrow();
  });

  it('should reject missing keywords in mining', () => {
    expect(() =>
      RepoBenchConfigSchema.parse({
        mining: {
          exclude_paths: ['node_modules/'],
        },
      }),
    ).toThrow();
  });

  it('should reject missing exclude_paths in mining', () => {
    expect(() =>
      RepoBenchConfigSchema.parse({
        mining: {
          keywords: ['fix'],
        },
      }),
    ).toThrow();
  });

  it('should reject non-string elements in keywords array', () => {
    expect(() =>
      RepoBenchConfigSchema.parse({
        mining: {
          keywords: ['fix', 123],
          exclude_paths: [],
        },
      }),
    ).toThrow();
  });

  it('should accept a config with only required fields', () => {
    const result = RepoBenchConfigSchema.parse({
      mining: {
        keywords: ['fix'],
        exclude_paths: ['node_modules/', '.git/'],
      },
    });
    expect(result.mining.keywords).toEqual(['fix']);
    expect(result.mining.exclude_paths).toEqual(['node_modules/', '.git/']);
    expect(result.mining.since).toBeUndefined();
    expect(result.mining.limit).toBeUndefined();
    expect(result.sandbox).toBeUndefined();
    expect(result.curation).toBeUndefined();
  });

  it('should transform sandbox snake_case fields to camelCase', () => {
    const result = RepoBenchConfigSchema.parse({
      mining: {
        keywords: ['fix'],
        exclude_paths: [],
      },
      sandbox: {
        build_command: 'npm ci',
        test_command: 'npm test',
        base_image: 'node:20-alpine',
        env_vars: { NODE_ENV: 'test' },
        cache_paths: ['/root/.npm'],
      },
    });
    expect(result.sandbox).toEqual({
      buildCommand: 'npm ci',
      testCommand: 'npm test',
      baseImage: 'node:20-alpine',
      envVars: { NODE_ENV: 'test' },
      cachePaths: ['/root/.npm'],
    });
  });

  it('should handle partial sandbox config with only build_command', () => {
    const result = RepoBenchConfigSchema.parse({
      mining: {
        keywords: ['fix'],
        exclude_paths: [],
      },
      sandbox: {
        build_command: 'npm ci',
      },
    });
    expect(result.sandbox).toBeDefined();
    expect(result.sandbox!.buildCommand).toBe('npm ci');
    expect(result.sandbox!.testCommand).toBeUndefined();
    expect(result.sandbox!.baseImage).toBeUndefined();
  });

  it('should propagate mining.since as-is when valid ISO datetime', () => {
    const result = RepoBenchConfigSchema.parse({
      mining: {
        keywords: ['fix'],
        exclude_paths: [],
        since: '2025-06-01T00:00:00Z',
      },
    });
    expect(result.mining.since).toBe('2025-06-01T00:00:00Z');
  });

  it('should transform sandbox.agent_setup_commands to agentSetupCommands', () => {
    const result = RepoBenchConfigSchema.parse({
      mining: {
        keywords: ['fix'],
        exclude_paths: [],
      },
      sandbox: {
        agent_setup_commands: ['npm install -g opencode'],
      },
    });
    expect(result.sandbox).toBeDefined();
    expect(result.sandbox!.agentSetupCommands).toEqual(['npm install -g opencode']);
  });

  it('should handle empty agent_setup_commands array', () => {
    const result = RepoBenchConfigSchema.parse({
      mining: {
        keywords: ['fix'],
        exclude_paths: [],
      },
      sandbox: {
        agent_setup_commands: [],
      },
    });
    expect(result.sandbox).toBeDefined();
    expect(result.sandbox!.agentSetupCommands).toEqual([]);
  });

  it('should transform agent_setup_commands alongside other sandbox fields', () => {
    const result = RepoBenchConfigSchema.parse({
      mining: {
        keywords: ['fix'],
        exclude_paths: [],
      },
      sandbox: {
        build_command: 'npm ci',
        test_command: 'npm test',
        base_image: 'node:20-alpine',
        env_vars: { NODE_ENV: 'test' },
        cache_paths: ['/root/.npm'],
        agent_setup_commands: ['npm install -g opencode', 'pip install aider-chat'],
      },
    });
    expect(result.sandbox).toEqual({
      buildCommand: 'npm ci',
      testCommand: 'npm test',
      baseImage: 'node:20-alpine',
      envVars: { NODE_ENV: 'test' },
      cachePaths: ['/root/.npm'],
      agentSetupCommands: ['npm install -g opencode', 'pip install aider-chat'],
    });
  });

  it('should reject non-string elements in agent_setup_commands array', () => {
    expect(() =>
      RepoBenchConfigSchema.parse({
        mining: {
          keywords: ['fix'],
          exclude_paths: [],
        },
        sandbox: {
          agent_setup_commands: ['npm install -g opencode', 42],
        },
      }),
    ).toThrow();
  });
});

describe('RepoBenchConfigSchema — database block', () => {
  it('should be optional — database is undefined when not provided', () => {
    const result = RepoBenchConfigSchema.parse({
      mining: { keywords: ['fix'], exclude_paths: [] },
    });
    expect(result.database).toBeUndefined();
  });

  it('should parse database block with a custom path', () => {
    const result = RepoBenchConfigSchema.parse({
      mining: { keywords: ['fix'], exclude_paths: [] },
      database: { path: '/custom/storage/db.sqlite' },
    });
    expect(result.database).toBeDefined();
    expect(result.database!.path).toBe('/custom/storage/db.sqlite');
  });

  it('should default database.path to ~/.repobench/db/repobench.db when block is empty', () => {
    const result = RepoBenchConfigSchema.parse({
      mining: { keywords: ['fix'], exclude_paths: [] },
      database: {},
    });
    expect(result.database).toBeDefined();
    expect(result.database!.path).toBe('~/.repobench/db/repobench.db');
  });

  it('should accept database block alongside sandbox and curation sections', () => {
    const result = RepoBenchConfigSchema.parse({
      mining: { keywords: ['fix', 'bug'], exclude_paths: [] },
      sandbox: { build_command: 'npm ci' },
      curation: { prompt: 'Evaluate this fix' },
      database: { path: '/data/repobench.db' },
    });
    expect(result.database).toBeDefined();
    expect(result.database!.path).toBe('/data/repobench.db');
    expect(result.sandbox).toBeDefined();
    expect(result.sandbox!.buildCommand).toBe('npm ci');
    expect(result.curation).toBeDefined();
    expect(result.curation!.prompt).toBe('Evaluate this fix');
  });

  it('should reject database.path when it is not a string', () => {
    expect(() =>
      RepoBenchConfigSchema.parse({
        mining: { keywords: ['fix'], exclude_paths: [] },
        database: { path: 42 },
      }),
    ).toThrow();
  });
});
