import { ISandbox } from '../types/contracts';
import { SandboxOptions } from '../types/contracts';
import { DockerSandbox } from './docker';
import { LocalSandbox } from './local';
import { RepoBenchConfig } from '../core/config';
import { z } from 'zod';

export { DockerSandbox, LocalSandbox };

const SandboxOptionsSchema = z.object({
  repoPath: z.string(),
  image: z.string(),
  commitHash: z.string(),
  buildCommand: z.string().optional(),
  testCommand: z.string().optional(),
  envVars: z.record(z.string()).optional(),
  cachePaths: z.record(z.string()).optional(),
});

export class SandboxFactory {
  static create(options: Partial<SandboxOptions>, config: RepoBenchConfig, useDocker = true): ISandbox {
    const merged = {
      repoPath: options.repoPath,
      image: options.image,
      commitHash: options.commitHash,
      buildCommand: options.buildCommand ?? config.sandbox.build_command,
      testCommand: options.testCommand ?? config.sandbox.test_command,
      envVars: { ...config.sandbox.env_vars, ...options.envVars },
      cachePaths: { ...config.sandbox.cache_paths, ...options.cachePaths },
    };

    const validatedOptions = SandboxOptionsSchema.parse(merged);
    return useDocker ? new DockerSandbox(validatedOptions) : new LocalSandbox(validatedOptions);
  }
}
