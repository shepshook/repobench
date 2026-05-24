import { z } from 'zod';
import YAML from 'yaml';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const RepoBenchConfigSchema = z.object({
  mining: z.object({
    keywords: z.array(z.string()),
    exclude_paths: z.array(z.string()),
    since: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/).optional(),
    limit: z.number().optional(),
  }),
  curation: z.object({
    prompt: z.string().optional(),
  }).optional(),
  sandbox: z.object({
    build_command: z.string().optional(),
    test_command: z.string().optional(),
    env_vars: z.record(z.string()).optional(),
    base_image: z.string().optional(),
    cache_paths: z.array(z.string()).optional(),
    agent_setup_commands: z.array(z.string()).optional(),
  }).optional(),
  database: z.object({
    path: z.string().optional().default('~/.repobench/db/repobench.db'),
  }).optional(),
}).transform((data) => ({
  ...data,
  sandbox: data.sandbox ? {
    buildCommand: data.sandbox.build_command,
    testCommand: data.sandbox.test_command,
    envVars: data.sandbox.env_vars,
    baseImage: data.sandbox.base_image,
    cachePaths: data.sandbox.cache_paths,
    agentSetupCommands: data.sandbox.agent_setup_commands,
  } : undefined,
}));

export type RepoBenchConfig = z.infer<typeof RepoBenchConfigSchema>;

const DEFAULT_CONFIG: RepoBenchConfig = {
  mining: {
    keywords: [],
    exclude_paths: ['node_modules/', '.git/'],
    since: undefined,
    limit: undefined,
  },
  sandbox: undefined,
};

export async function loadConfig(path: string = 'repobench.yaml'): Promise<RepoBenchConfig> {
  try {
    const fileContents = await fs.readFile(path, 'utf8');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parsed = YAML.parse(fileContents);
    return RepoBenchConfigSchema.parse(parsed);
  } catch (error: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    if (error instanceof Error && (error as any).code === 'ENOENT') {
      return DEFAULT_CONFIG;
    }
    throw error;
  }
}

function findProjectRoot(startDir: string): string {
  const markers = ['package.json', 'repobench.yaml'];
  let current = path.resolve(startDir);
  while (true) {
    for (const marker of markers) {
      if (fsSync.existsSync(path.join(current, marker))) {
        return current;
      }
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return startDir;
    }
    current = parent;
  }
}

/**
 * Resolve a database path from user-supplied config.
 *
 * 1. If the path starts with `~`, it is expanded using `os.homedir()`.
 * 2. If the result is an absolute path, it is kept as-is (no forward-slash coercion).
 * 3. If it is a relative path, it is resolved against the project root
 *    (discovered by walking up from `process.cwd()` looking for `package.json`
 *    or `repobench.yaml`).
 * 4. The parent directory of the resolved path is created via `fs.mkdirSync`.
 *
 * @param configPath - User-specified database path (defaults to ~/.repobench/db/repobench.db).
 * @param projectRoot - Optional explicit project root; detected from process.cwd() when omitted.
 */
export function resolveDatabasePath(configPath?: string, projectRoot?: string): string {
  const raw = configPath || '~/.repobench/db/repobench.db';

  if (raw.startsWith('~')) {
    const homedir = os.homedir();
    const suffix = raw.slice(1);
    const normalizedSuffix = homedir.includes('\\') ? suffix.replace(/\//g, '\\') : suffix;
    const result = homedir + normalizedSuffix;
    fsSync.mkdirSync(path.dirname(result), { recursive: true });
    return result;
  }

  if (path.isAbsolute(raw) || raw.startsWith('/')) {
    fsSync.mkdirSync(path.dirname(raw), { recursive: true });
    return raw;
  }

  const root = findProjectRoot(projectRoot || process.cwd());
  const result = path.resolve(root, raw);
  fsSync.mkdirSync(path.dirname(result), { recursive: true });
  return result;
}
