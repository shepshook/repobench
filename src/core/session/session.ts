import { ISession, SessionResult, ISandbox } from '../../types/contracts';
import { SandboxStateManager, StateCandidate } from '../../sandbox/state-manager';
import { SessionCrashedError } from './errors';
import path from 'path';
import fs from 'fs/promises';
import * as pty from 'node-pty';

const MAX_BUFFER_SIZE = 1024 * 1024;
const ANSI_REGEX = /\x1b\[[0-9;?]*[a-zA-Z]/g;

function stripAnsi(str: string) {
  return str.replace(ANSI_REGEX, '');
}

export class Session implements ISession {
  private sandbox: ISandbox;
  private stateManager: SandboxStateManager;
  private filesOpened = new Set<string>();
  private filesModified = new Set<string>();
  private stdout = '';
  private stderr = '';
  private startTime: number = 0;
  private lastReadOffset = 0;
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
    const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';
    const shellArgs = process.platform === 'win32' ? ['-NoProfile'] : [];
    const shellName = process.platform === 'win32' ? 'powershell' : 'bash';

    this.ptyProcess = pty.spawn(shell, shellArgs, {
      name: shellName,
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

    // Consume initial prompt
    await this.readUntil(/[>#$]\s*$/);
  }

  private checkPendingReads() {
    for (let i = this.pendingReads.length - 1; i >= 0; i--) {
      const { regex, resolve, offset } = this.pendingReads[i];
      const searchArea = stripAnsi(this.stdout.substring(offset));
      const match = searchArea.match(regex);
      if (match && match.index !== undefined) {
        const read = this.pendingReads[i];
        clearTimeout(read.timeoutId);
        this.pendingReads.splice(i, 1);
        this.lastReadOffset = this.stdout.length;
        resolve(this.stdout);
      }
    }
  }

  private async getFilesystemSnapshot(dir: string): Promise<Map<string, number>> {
    const snapshot = new Map<string, number>();
    const scan = async (currentDir: string, relativePath: string) => {
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          const relPath = relativePath ? path.join(relativePath, entry.name) : entry.name;
          if (entry.isDirectory()) {
            await scan(fullPath, relPath);
          } else if (entry.isFile()) {
            try {
              const stats = await fs.stat(fullPath);
              snapshot.set(relPath, stats.mtimeMs);
            } catch (e) {
              // File might have been deleted since readdir
            }
          }
        }
      } catch (e) {
        // Directory might have been deleted or inaccessible
      }
    };
    await scan(dir, '');
    return snapshot;
  }

  async write(command: string): Promise<void> {
    const promise = this.writeLock.then(async () => {
      if (!this.ptyProcess) {
        throw new Error('Session not started. Call start() first.');
      }

      await this.ping();

      const workingDir = await this.sandbox.getWorkingDir();
      const snapshotBefore = await this.getFilesystemSnapshot(workingDir);

      this.ptyProcess.write(command + '\r\n');

      const promptRegex = /[>#$]\s*$/;
      await this.readUntil(promptRegex);
      
      // Give the filesystem a moment to catch up
      await new Promise(resolve => setTimeout(resolve, 100));

      const snapshotAfter = await this.getFilesystemSnapshot(workingDir);
      const modifiedInThisCall = new Set<string>();
      for (const [file, mtimeAfter] of snapshotAfter) {
        const mtimeBefore = snapshotBefore.get(file);
        if (mtimeBefore === undefined || mtimeAfter > mtimeBefore) {
          this.filesModified.add(file);
          modifiedInThisCall.add(file);
        }
      }

      const pathRegex = /([a-zA-Z0-9._\-/]+)/g;
      const matches = command.match(pathRegex) || [];
      const candidateFiles = [...new Set(matches)];
      for (const file of candidateFiles) {
        const relFile = path.isAbsolute(file) ? path.relative(workingDir, file) : file;
        if (snapshotAfter.has(relFile) && !modifiedInThisCall.has(relFile)) {
          this.filesOpened.add(relFile);
        }
      }
    });

    this.writeLock = promise.catch(() => {});
    return promise;
  }


  async readUntil(regex: RegExp, timeout: number = 30000): Promise<string> {
    const searchArea = stripAnsi(this.stdout.substring(this.lastReadOffset));
    const match = searchArea.match(regex);
    if (match && match.index !== undefined) {
      this.lastReadOffset = this.stdout.length;
      return this.stdout;
    }
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingReads = this.pendingReads.filter(r => r.timeoutId !== timeoutId);
        reject(new Error(`Timeout waiting for regex ${regex} after ${timeout}ms`));
      }, timeout);

      this.pendingReads.push({ regex, resolve, reject, timeoutId, offset: this.lastReadOffset });
    });
  }

  private async ping(): Promise<void> {
    if (this.isCrashed) throw new SessionCrashedError();

    try {
      this.ptyProcess?.write('echo 1\r\n');
       const promptRegex = /[>#$]\s*$/;
      await this.readUntil(promptRegex, 5000);
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
