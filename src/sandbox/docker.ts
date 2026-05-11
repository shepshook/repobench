import { ISandbox } from './types';
import { SandboxOptions } from '../types/contracts';
import Docker from 'dockerode';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import crypto from 'crypto';

export class DockerSandbox implements ISandbox {
  private docker: Docker;
  private container: any;
  private options: SandboxOptions;
  private hostTempDir?: string;

  constructor(options: SandboxOptions) {
    this.docker = new Docker();
    this.options = options;
  }

  async init() {
    try {
      this.hostTempDir = path.join(os.tmpdir(), `repobench-docker-${crypto.randomUUID()}`);
      await fs.mkdir(this.hostTempDir, { recursive: true });

      this.container = await this.docker.createContainer({
        Image: this.options.image,
        Cmd: ['/bin/bash'],
        Tty: true,
        WorkingDir: '/app',
        HostConfig: { Binds: [`${this.hostTempDir}:/app`] },
        Env: Object.entries(this.options.envVars || {}).map(([k, v]) => `${k}=${v}`),
      });
      await this.container.start();
      
      await this.execute('apt-get update && apt-get install -y git');
      await this.runDirect(['git', 'clone', this.options.repoPath, '.']);
      await this.runDirect(['git', 'checkout', this.options.commitHash]);
    } catch (e: any) {
      throw new Error(`DockerSandbox init failed: ${e.message}`);
    }
  }

  private async runDirect(args: string[]): Promise<string> {
    const exec = await this.container.exec({
      Cmd: args,
      AttachStdout: true,
      AttachStderr: true,
    });
    const stream = await exec.start();
    const output = await new Promise<string>((resolve, reject) => {
      let data = '';
      stream.on('data', (chunk: any) => { data += chunk.toString(); });
      stream.on('end', () => resolve(data.trim()));
      stream.on('error', reject);
    });

    const inspect = await exec.inspect();
    if (inspect.ExitCode !== 0) {
      throw new Error(`Command ${args.join(' ')} failed with exit code ${inspect.ExitCode}. Output: ${output}`);
    }
    return output;
  }

  async execute(cmd: string): Promise<string> {
    const exec = await this.container.exec({
      Cmd: ['bash', '-c', cmd],
      AttachStdout: true,
      AttachStderr: true,
    });
    const stream = await exec.start();
    const output = await new Promise<string>((resolve, reject) => {
      let data = '';
      stream.on('data', (chunk: any) => { data += chunk.toString(); });
      stream.on('end', () => resolve(data.trim()));
      stream.on('error', reject);
    });

    const inspect = await exec.inspect();
    if (inspect.ExitCode !== 0) {
      throw new Error(`Command failed (ExitCode ${inspect.ExitCode}): ${output}`);
    }
    return output;
  }

  async setup(): Promise<void> {
    if (this.options.buildCommand) {
      await this.execute(this.options.buildCommand);
    }
  }

  async verify(): Promise<boolean> {
    if (this.options.testCommand) {
      try {
        await this.execute(this.options.testCommand);
        return true;
      } catch (e) {
        return false;
      }
    }
    return true;
  }

  async destroy() {
    if (this.container) {
      try {
        await this.container.stop();
        await this.container.remove();
      } catch (e) {
        console.error(`Failed to remove Docker container:`, e);
      }
    }
    if (this.hostTempDir) {
      try {
        await fs.rm(this.hostTempDir, { recursive: true, force: true });
      } catch (e) {
        console.error(`Failed to remove Docker host temp dir:`, e);
      }
    }
  }
}
