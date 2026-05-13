import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { z } from 'zod';

export const MiningConfigSchema = z.object({
  keywords: z.array(z.string()).default(['fix', 'bug', 'issue']),
  exclude_paths: z.array(z.string()).default([]),
  source_extensions: z.array(z.string()).default(['ts', 'js', 'py', 'cpp', 'c', 'go', 'rs', 'java']),
});

export const SandboxConfigSchema = z.object({
  build_command: z.string().default(''),
  test_command: z.string().default(''),
  env_vars: z.record(z.string()).default({}),
  base_image: z.string().optional(),
  base_image_path: z.string().optional(),
  cache_paths: z.record(z.string()).default({}),
  pre_build_commands: z.array(z.string()).optional(),
  pre_build_hash_file: z.string().optional(),
  max_cached_layers: z.number().default(10),
});

export const RepoBenchConfigSchema = z.object({
  mining: MiningConfigSchema.default({
    keywords: ['fix', 'bug', 'issue'],
    exclude_paths: [],
    source_extensions: ['ts', 'js', 'py', 'cpp', 'c', 'go', 'rs', 'java'],
  }),
  sandbox: SandboxConfigSchema.default({}),
  llm: z.object({
    model: z.string().default('gpt-4o-mini'),
    api_key: z.string().optional(),
    endpoint: z.string().optional(),
    temperature: z.number().min(0).max(2).default(0),
  }).default({
    model: 'gpt-4o-mini',
    temperature: 0,
  }),
});

export type RepoBenchConfig = z.infer<typeof RepoBenchConfigSchema>;

export class Config {
  /**
   * Loads the configuration from a YAML file.
   * If the file is missing, returns the default configuration.
   */
  static load(configPath: string = 'repobench.yaml'): RepoBenchConfig {
    const absolutePath = path.resolve(process.cwd(), configPath);
    
    if (!fs.existsSync(absolutePath)) {
      console.warn(`Config file not found at ${absolutePath}. Using default settings.`);
      return RepoBenchConfigSchema.parse({});
    }

    try {
      const fileContent = fs.readFileSync(absolutePath, 'utf8');
      const parsedYaml = yaml.parse(fileContent);
      return RepoBenchConfigSchema.parse(parsedYaml);
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        throw new Error(`Invalid repobench.yaml configuration:\n${e.message}`);
      }
      throw new Error(`Failed to read repobench.yaml: ${e.message}`);
    }
  }
}
