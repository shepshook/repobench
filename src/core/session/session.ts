import { ISession, SessionResult, ISandbox } from '../../types/contracts';
import { SandboxStateManager, StateCandidate } from '../../sandbox/state-manager';
import { DockerSandbox } from '../../sandbox/docker';
import * as pty from 'node-pty';
import path from 'path';
import * as fs from 'fs';
import { mkdir } from 'fs/promises';

export class TimeoutError extends Error {
  constructor(message: string = 'Operation timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class Session implements ISession {
  private sandbox: ISandbox;
  private stateManager: SandboxStateManager;
  private filesOpened = new Set<string>();
  private filesModified = new Set<string>();
  private stdout = '';
  private stderr = '';
  private startTime: number = 0;
  private ptyProcess: any = null;
  private buffer = '';
  private logStream?: fs.WriteStream;

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

    await mkdir('logs', { recursive: true });
    const logFile = path.join('logs', `session_${this.startTime}.log`);
    this.logStream = fs.createWriteStream(logFile, { flags: 'a' });

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

    this.buffer = '';
    this.ptyProcess.on('data', (data: string) => {
      this.buffer += data;
      if (this.logStream) {
        this.logStream.write(`[IN] ${data}`);
      }
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

  async write(text: string): Promise<void> {
    if (!this.ptyProcess) {
      throw new Error('Session not started');
    }
    if (this.logStream) {
      this.logStream.write(`[OUT] ${text}\r\n`);
    }
    this.ptyProcess.write(`${text}\r\n`);
  }

  async readUntil(regex: RegExp, timeout: number = 30000): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.ptyProcess?.off('data', onData);
        reject(new TimeoutError());
      }, timeout);
  
      const onData = () => {
        const match = this.buffer.match(regex);
        if (match) {
          clearTimeout(timer);
          const output = this.buffer.slice(0, match.index! + match[0].length);
          this.buffer = this.buffer.slice(match.index! + match[0].length);
          this.ptyProcess?.off('data', onData);
          resolve(output);
        }
      };
  
      const initialMatch = this.buffer.match(regex);
      if (initialMatch) {
        clearTimeout(timer);
        const output = this.buffer.slice(0, initialMatch.index! + initialMatch[0].length);
        this.buffer = this.buffer.slice(initialMatch.index! + initialMatch[0].length);
        resolve(output);
        return;
      }
  
      this.ptyProcess?.on('data', onData);
    });
  }
  
  async resize(cols: number, rows: number): Promise<void> {
    if (!this.ptyProcess) {
      throw new Error('Session not started');
    }
    this.ptyProcess.resize(cols, rows);
  }
  
  async end(): Promise<SessionResult> {
    if (this.ptyProcess) {
      try {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            this.ptyProcess?.off('exit', onExit);
            this.ptyProcess?.off('close', onExit);
            resolve();
          }, 1000);
  
          const onExit = () => {
            clearTimeout(timeout);
            this.ptyProcess?.off('exit', onExit);
            this.ptyProcess?.off('close', onExit);
            resolve();
          };
          this.ptyProcess?.on('exit', onExit);
          this.ptyProcess?.on('close', onExit);
          this.ptyProcess.kill();
        });
      } catch (error) {
        // Ignore errors during termination
      }
    }
  
    if (this.logStream) {
      this.logStream.end();
    }
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
