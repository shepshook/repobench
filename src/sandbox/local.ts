import { ISandbox } from '../types/contracts';
import { SandboxOptions } from '../types/contracts';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

export class LocalSandbox implements ISandbox {
  private tempDir: string;
  private workingDir: string;
  private options: SandboxOptions;
  private activeProcesses: Set<any> = new Set();

  constructor(options: SandboxOptions) {
    this.options = options;
    this.tempDir = path.join(os.tmpdir(), `repobench-local-${crypto.randomUUID()}`);
    this.workingDir = this.tempDir;
  }

  async init() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      const repoDir = path.join(this.tempDir, 'repo');
      
      try {
        await fs.access(repoDir);
        // Repo already exists, skip clone
      } catch {
        await this.runCommand('git', ['clone', this.options.repoPath, repoDir], this.tempDir);
      }
      
      this.workingDir = repoDir;
      await this.runCommand('git', ['checkout', this.options.commitHash], this.workingDir);
    } catch (e: any) {
      throw new Error(`LocalSandbox init failed: ${e.message}`);
    }
  }

  private async runCommand(cmd: string, args: string[], cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, { cwd, shell: false });
      this.activeProcesses.add(child);
      child.on('close', (code) => {
        this.activeProcesses.delete(child);
        if (code === 0) resolve();
        else reject(new Error(`Command ${cmd} ${args.join(' ')} failed with code ${code}`));
      });
      child.on('error', reject);
    });
  }

  async execute(cmd: string, timeout?: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      const child = spawn(cmd, { 
        cwd: this.workingDir, 
        shell: true,
        signal: controller.signal,
        env: { ...process.env, ...this.options.envVars }
      });
      
      this.activeProcesses.add(child);
      let stdout = '';
      let stderr = '';

      const timer = timeout ? setTimeout(() => {
        controller.abort();
        reject(new Error('TimeoutError: Command exceeded timeout'));
      }, timeout) : null;

      child.stdout.on('data', (data) => { stdout += data; });
      child.stderr.on('data', (data) => { stderr += data; });

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

  async switchToState(commitHash: string): Promise<void> {
    await this.runCommand('git', ['checkout', commitHash], this.workingDir);
  }

  async destroy() {
    for (const proc of this.activeProcesses) {
      try { proc.kill('SIGKILL'); } catch {}
    }
    this.activeProcesses.clear();
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    } catch (e) {
      console.error(`Failed to destroy LocalSandbox at ${this.tempDir}:`, e);
    }
  }

  getWorkingDir(): string {
    return this.workingDir;
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
