import { z } from 'zod';
import YAML from 'yaml';
import fs from 'node:fs/promises';

export const RepoBenchConfigSchema = z.object({
  mining: z.object({
    keywords: z.array(z.string()),
    exclude_paths: z.array(z.string()),
    since: z.string().datetime().optional(),
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
  }).optional(),
}).transform((data) => ({
  ...data,
  sandbox: data.sandbox ? {
    buildCommand: data.sandbox.build_command,
    testCommand: data.sandbox.test_command,
    envVars: data.sandbox.env_vars,
    baseImage: data.sandbox.base_image,
    cachePaths: data.sandbox.cache_paths,
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
    const parsed = YAML.parse(fileContents);
    return RepoBenchConfigSchema.parse(parsed);
  } catch (error: unknown) {
    if (error instanceof Error && (error as any).code === 'ENOENT') {
      return DEFAULT_CONFIG;
    }
    throw error;
  }
}
