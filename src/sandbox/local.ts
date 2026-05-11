import { ISandbox } from './types';
import { SandboxOptions } from '../types/contracts';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

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
  private activeProcesses: Set<ChildProcess> = new Set();

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

  async execute(cmd: string, timeout?: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      const { signal } = controller;

      const child = spawn(cmd, { 
        cwd: this.tempDir, 
        shell: true,
        env: { ...process.env, ...this.options.envVars },
        signal 
      });

      this.activeProcesses.add(child);

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => { stdout += data; });
      child.stderr.on('data', (data) => { stderr += data; });

      const timer = timeout ? setTimeout(() => {
        controller.abort();
        reject(new Error('TimeoutError: Command exceeded timeout'));
      }, timeout) : null;

      child.on('close', (code) => {
        if (timer) clearTimeout(timer);
        this.activeProcesses.delete(child);
        if (code === 0) resolve(stdout.trim());
        else reject(new Error(`Command failed (ExitCode ${code}): ${stderr || stdout}`));
      });

      child.on('error', (err) => {
        if (timer) clearTimeout(timer);
        this.activeProcesses.delete(child);
        if (err.name === 'AbortError') {
          reject(new Error('TimeoutError: Command exceeded timeout'));
        } else {
          reject(err);
        }
      });
    });
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
      for (const proc of this.activeProcesses) {
        try {
          proc.kill('SIGKILL');
        } catch (e) {}
      }
      this.activeProcesses.clear();
      await fs.rm(this.tempDir, { recursive: true, force: true });
    } catch (e) {
      console.error(`Failed to destroy LocalSandbox at ${this.tempDir}:`, e);
    }
  }

  getWorkingDir(): string {
    return this.tempDir;
  }

  async ping(): Promise<boolean> {
    try {
      const stats = await fs.stat(this.tempDir);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }
}
