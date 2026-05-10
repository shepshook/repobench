import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { z } from 'zod';

export const MiningConfigSchema = z.object({
  keywords: z.array(z.string()).default(['fix', 'bug', 'issue']),
  exclude_paths: z.array(z.string()).default([]),
});

export const SandboxConfigSchema = z.object({
  build_command: z.string().optional(),
  test_command: z.string().optional(),
  env_vars: z.record(z.string()).default({}),
});

export const RepoBenchConfigSchema = z.object({
  mining: MiningConfigSchema.default({
    keywords: ['fix', 'bug', 'issue'],
    exclude_paths: [],
  }),
  sandbox: SandboxConfigSchema.default({}),
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
