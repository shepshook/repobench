import { ISession, SessionResult, ISandbox } from '../../types/contracts';
import { SandboxStateManager, StateCandidate } from '../../sandbox/state-manager';
import { DockerSandbox } from '../../sandbox/docker';
import * as pty from 'node-pty';
import path from 'path';
import fs from 'fs/promises';

export class Session implements ISession {
  private sandbox: ISandbox;
  private stateManager: SandboxStateManager;
  private filesOpened = new Set<string>();
  private filesModified = new Set<string>();
  private stdout = '';
  private stderr = '';
  private startTime: number = 0;
  private ptyProcess: any = null;

  constructor(sandbox: ISandbox) {
    this.sandbox = sandbox;
    this.stateManager = new SandboxStateManager();
  }

  async ensureState(state: 'pre' | 'post', candidate: StateCandidate): Promise<void> {
    const { needsRebuild, currentHash } = await this.stateManager.ensureState(this.sandbox, state, candidate);
    if (needsRebuild) {
      await this.sandbox.setup();
      this.stateManager.confirmBuildSuccess(currentHash);
    }
  }

  async start(): Promise<void> {
    this.startTime = Date.now();
    await this.sandbox.init();

    const workingDir = this.sandbox.getWorkingDir();
    let shell = '/bin/bash';
    let args: string[] = [];

    if (this.sandbox instanceof DockerSandbox) {
      const containerId = this.sandbox.getContainerId();
      if (!containerId) {
        throw new Error('DockerSandbox container ID not found');
      }
      shell = 'docker';
      args = ['exec', '-it', containerId, '/bin/bash'];
    }

    this.ptyProcess = pty.spawn(shell, args, {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: this.sandbox instanceof DockerSandbox ? process.cwd() : workingDir,
    });

    // Health check
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('PTY health check timed out')), 5000);
      
      const onData = (data: string) => {
        if (data.includes('1')) {
          this.ptyProcess?.off('data', onData);
          clearTimeout(timeout);
          resolve();
        }
      };

      this.ptyProcess?.on('data', onData);
      this.ptyProcess?.write('echo 1\r');
    });
  }

  async write(command: string): Promise<void> {
    const workingDir = await this.sandbox.getWorkingDir();
    const pathRegex = /([a-zA-Z0-9._\-/]+\.[a-z]{2,4})/g;
    const matches = command.match(pathRegex) || [];
    const candidateFiles = [...new Set(matches)];

    const mtimesBefore = new Map<string, number>();
    for (const file of candidateFiles) {
      try {
        const fullPath = path.join(workingDir, file);
        const stats = await fs.stat(fullPath);
        mtimesBefore.set(file, stats.mtimeMs);
      } catch (e) {
        // File doesn't exist yet
      }
    }

    try {
      const output = await this.sandbox.execute(command);
      this.stdout += output;

      for (const file of candidateFiles) {
        try {
          const fullPath = path.join(workingDir, file);
          const stats = await fs.stat(fullPath);
          const mtimeBefore = mtimesBefore.get(file);

          if (mtimeBefore !== undefined && stats.mtimeMs > mtimeBefore) {
            this.filesModified.add(file);
          } else {
            this.filesOpened.add(file);
          }
        } catch (e) {
          // File was created during command
          this.filesOpened.add(file);
        }
      }
    } catch (e: any) {
      this.stderr += e.message;
      throw e;
    }
  }

  async readUntil(regex: RegExp): Promise<string> {
    return '';
  }

  async end(): Promise<SessionResult> {
    const duration = Date.now() - this.startTime;
    return {
      stdout: this.stdout,
      stderr: this.stderr,
      exitCode: 0,
      duration,
      tokensUsed: { input: 0, output: 0 },
      cost: 0,
      filesOpened: this.filesOpened.size,
      filesModified: this.filesModified.size,
    };
  }
}
