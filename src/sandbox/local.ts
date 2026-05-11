import { ISandbox } from './types';
import { SandboxOptions } from '../types/contracts';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const execAsync = promisify(exec);

async function runCommand(cmd: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });
    child.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`Command ${cmd} ${args.join(' ')} failed with code ${code}. Stderr: ${stderr}`));
    });
  });
}

export class LocalSandbox implements ISandbox {
  private tempDir: string;
  private options: SandboxOptions;

  constructor(options: SandboxOptions) {
    this.options = options;
    this.tempDir = path.join(os.tmpdir(), `repobench-local-${crypto.randomUUID()}`);
  }

  async init() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      
      // Use argument arrays to prevent command injection
      await runCommand('git', ['clone', this.options.repoPath, this.tempDir], process.cwd());
      await runCommand('git', ['checkout', this.options.commitHash], this.tempDir);
    } catch (e: any) {
      throw new Error(`LocalSandbox init failed: ${e.message}`);
    }
  }

  async execute(cmd: string): Promise<string> {
    try {
      const { stdout } = await execAsync(cmd, { 
        cwd: this.tempDir, 
        encoding: 'utf8',
        env: { ...process.env, ...this.options.envVars }
      });
      return stdout.trim();
    } catch (e: any) {
      const errorOutput = e.stdout ? e.stdout.toString().trim() : e.message;
      throw new Error(`Command failed (ExitCode ${e.code}): ${errorOutput}`);
    }
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
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    } catch (e) {
      console.error(`Failed to destroy LocalSandbox at ${this.tempDir}:`, e);
    }
  }
}
