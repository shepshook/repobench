import { ISession, SessionResult, ISandbox } from '../../types/contracts';
import { SandboxStateManager, StateCandidate } from '../../sandbox/state-manager';
import { SessionCrashedError } from './errors';
import path from 'path';
import fs from 'fs/promises';
import * as pty from 'node-pty';

const MAX_BUFFER_SIZE = 1024 * 1024;

export class Session implements ISession {
  private sandbox: ISandbox;
  private stateManager: SandboxStateManager;
  private filesOpened = new Set<string>();
  private filesModified = new Set<string>();
  private stdout = '';
  private stderr = '';
  private startTime: number = 0;
  private ptyProcess: pty.IPty | null = null;
  private isCrashed = false;
  private writeLock: Promise<void> = Promise.resolve();
  private pendingReads: Array<{ regex: RegExp, resolve: (value: string) => void, reject: (reason: any) => void, timeoutId: NodeJS.Timeout, offset: number }> = [];

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
    if (this.ptyProcess) return;
    this.startTime = Date.now();
    await this.sandbox.init();

    const workingDir = this.sandbox.getWorkingDir();
    this.ptyProcess = pty.spawn('powershell.exe', [], {
      name: 'powershell',
      cwd: workingDir,
      env: process.env,
    });

    this.ptyProcess.onData((data) => {
      this.stdout += data;
      
      if (this.stdout.length > MAX_BUFFER_SIZE) {
        const truncateLen = this.stdout.length - MAX_BUFFER_SIZE;
        this.stdout = this.stdout.substring(truncateLen);
        for (const read of this.pendingReads) {
          read.offset = Math.max(0, read.offset - truncateLen);
        }
      }

      this.checkPendingReads();
    });
  }

  private checkPendingReads() {
    for (let i = this.pendingReads.length - 1; i >= 0; i--) {
      const { regex, resolve, offset } = this.pendingReads[i];
      if (regex.test(this.stdout.substring(offset))) {
        const read = this.pendingReads[i];
        clearTimeout(read.timeoutId);
        this.pendingReads.splice(i, 1);
        resolve(this.stdout);
      }
    }
  }

  async write(command: string): Promise<void> {
    const promise = this.writeLock.then(async () => {
      if (!this.ptyProcess) {
        throw new Error('Session not started. Call start() first.');
      }

      await this.ping();

      this.ptyProcess.write(command + '\r\n');

      const promptRegex = /PS\s+.*>\s*$/;
      await this.readUntil(promptRegex);

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
    });

    this.writeLock = promise.catch(() => {});
    return promise;
  }

  async readUntil(regex: RegExp, timeout: number = 30000): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingReads = this.pendingReads.filter(r => r.timeoutId !== timeoutId);
        reject(new Error(`Timeout waiting for regex ${regex} after ${timeout}ms`));
      }, timeout);

      this.pendingReads.push({ regex, resolve, reject, timeoutId, offset: this.stdout.length });
    });
  }

  private async ping(): Promise<void> {
    if (this.isCrashed) throw new SessionCrashedError();

    try {
      this.ptyProcess?.write('echo 1\r\n');
      const promptRegex = /PS\s+.*>\s*$/;
      await this.readUntil(promptRegex, 2000);
    } catch (e) {
      this.isCrashed = true;
      throw new SessionCrashedError();
    }
  }

  async end(): Promise<SessionResult> {
    this.ptyProcess?.kill();

    for (const read of this.pendingReads) {
      clearTimeout(read.timeoutId);
      read.reject(new Error('Session ended'));
    }
    this.pendingReads = [];
    this.ptyProcess = null;

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
