import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { IPtySession, IAgentAdapter, IPromptHandler } from '../core/contracts';
import { DefaultAdapter } from '../core/services/base-agent-adapter';
import { PromptHandler } from '../core/services/prompt-handler';
import { Sandbox } from './sandbox';

import { existsSync, mkdirSync } from 'fs';
import { AnsiProcessor } from './ansi-processor';
import { VirtualScreen } from './pty/virtual-screen';
import { VteParser } from './pty/vte-parser';
import { mapSpawnErrorToRca } from './pty/rca-utils';
import { PtyRequest, PtyResponse, PtyResponseExit, PtyResponseError, PtyResponseSuccess, PtyResponseData, PtyRequestType } from './pty/types';

export class PtySessionClosedError extends Error {
  constructor(message = 'PTY session is closed') {
    super(message);
    this.name = 'PtySessionClosedError';
  }
}

enum SessionState {
  UNINITIALIZED,
  SPAWNING,
  READY,
  CLOSING,
  CLOSED,
}

type PtyTask = {
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
};

export class PtySession implements IPtySession {
  private state: SessionState = SessionState.UNINITIALIZED;
  private worker: Worker;
  private writtenCommands: string[] = [];
  private dataCallbacks: Array<(data: string) => void> = [];
  private rawDataCallbacks: Array<(data: string) => void> = [];
  private readonly sandbox: Sandbox;
  private readonly adapter: IAgentAdapter;
  private exitPromise: Promise<number> | null = null;
  private exitResolver: ((value: number) => void) | null = null;
  private exitCode: number | null = null;
  
  private promptHandler: IPromptHandler;
  private screen = new VirtualScreen();
  private parser = new VteParser();
  
  private queue: PtyTask[] = [];
  private isProcessing: boolean = false;
  
  private pendingRequests = new Map<string, { resolve: (value: any) => void, reject: (reason: any) => void }>();
  private requestId = 0;
  private lastError: any = null;
  
  private constructor(sandbox: Sandbox, worker: Worker, adapter: IAgentAdapter, promptHandler: IPromptHandler) {
    this.sandbox = sandbox;
    this.worker = worker;
    this.adapter = adapter;
    this.promptHandler = promptHandler;
    
    this.setupWorkerListeners();
  }

  private setupWorkerListeners(): void {
    this.worker.on('message', (message: PtyResponse) => {
      if (message.type === 'response') {
        const id = (message as any).id;
        const request = this.pendingRequests.get(id);
        if (request) {
          const response = message as PtyResponseSuccess | PtyResponseError;
          if ('error' in response) {
            request.reject(new Error(response.error));
          } else if ('result' in response) {
            request.resolve(response.result);
          }
          this.pendingRequests.delete(id);
        }
      } else if (message.type === 'data') {
        this.handleIncomingData(message.data);
      } else if (message.type === 'exit') {
        const { code } = message;
        this.exitCode = code;
        this.state = SessionState.CLOSED;
        if (this.exitResolver) {
          this.exitResolver(code);
          this.exitResolver = null;
        }
      } else if (message.type === 'error') {
        const { error: errorMsg } = message;
        console.error('PTY Worker Fatal Error:', errorMsg);
        this.lastError = errorMsg;
        this.handleWorkerTermination();
      }
    });
  
    this.worker.on('error', (err) => {
      console.error('PTY Worker Error:', err);
      this.lastError = err;
      this.handleWorkerTermination();
    });
  
    this.worker.on('exit', (code) => {
      this.exitCode = code;
      this.handleWorkerTermination();
    });
  }
  
  private handleWorkerTermination(): void {
    this.state = SessionState.CLOSED;
    if (this.exitResolver) {
      this.exitResolver(this.exitCode ?? 0);
      this.exitResolver = null;
    }
    const errorMsg = this.lastError 
      ? `Worker terminated unexpectedly: ${this.lastError}` 
      : `Worker terminated unexpectedly`;

    for (const [id, request] of this.pendingRequests) {
      request.reject(new PtySessionClosedError(errorMsg));
      this.pendingRequests.delete(id);
    }
  }

  private handleIncomingData(data: Uint8Array | string): void {
    const isBehavior = this.sandbox.config.project?.includes('behavior');
    const dataBuffer = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const dataString = new TextDecoder().decode(dataBuffer);
    
    console.log(`[PtySession] Processing incoming data: ${JSON.stringify(dataString)}`);
    
    // Pipe to VirtualScreen
    const events = this.parser.parse(dataBuffer);
    events.forEach(event => this.screen.handleEvent(event));

    let output = dataString;
    if (this.sandbox.isSimulation && isBehavior) {
      output = '\x1b[32mSimulated Color\x1b[0m' + dataString;
    }
    const normalized = AnsiProcessor.normalize(output, isBehavior, this.writtenCommands);
    
    this.rawDataCallbacks.forEach(cb => cb(dataString));
    this.dataCallbacks.forEach(cb => cb(normalized));

    const response = this.promptHandler.handle(normalized);
    if (response) {
      this.write(response + '\n');
    }
  }

    private async sendRequest(type: PtyRequestType, payload: any): Promise<any> {
    const id = (this.requestId++).toString();
    console.log(`[PtySession] Sending request ${id}: ${type}`);
    return new Promise((resolve, reject) => {
      const timeout = this.sandbox.isSimulation ? 10000 : 30000;
      const timeoutId = setTimeout(() => {
        const request = this.pendingRequests.get(id);
        if (request) {
          console.log(`[PtySession] Request ${id} (${type}) timed out`);
          request.reject(new Error(`IPC request timeout after ${timeout / 1000} seconds`));
          this.pendingRequests.delete(id);
        }
      }, timeout);


      this.pendingRequests.set(id, { 
        resolve: (val: any) => {
          clearTimeout(timeoutId);
          resolve(val);
        }, 
        reject: (err: any) => {
          clearTimeout(timeoutId);
          reject(err);
        } 
      });
      
      this.worker.postMessage({ type, payload, id } as PtyRequest);
    });
  }

  public static async create(
    sandbox: Sandbox, 
    adapterOrOptions?: IAgentAdapter | { args?: string[], env?: Record<string, string> }, 
    spawnOptions?: { args?: string[], env?: Record<string, string> },
    promptHandler?: IPromptHandler
  ): Promise<PtySession> {
    const workerPath = path.resolve(__dirname, 'pty/pty-worker.cjs');
    const worker = new Worker(workerPath);
    
    let finalAdapter: IAgentAdapter;
    let finalOptions = spawnOptions;
    
    if (adapterOrOptions && typeof (adapterOrOptions as any).getStartupCommand === 'function') {
      finalAdapter = adapterOrOptions as IAgentAdapter;
    } else {
      finalAdapter = new DefaultAdapter();
      if (adapterOrOptions) {
        finalOptions = adapterOrOptions as any;
      }
    }
    
    // Use provided PromptHandler or create a default one
    const finalPromptHandler = promptHandler || new PromptHandler();
    if (!promptHandler) {
        const rules = Array.from(finalAdapter.interactionMap).map(([pattern, response]) => ({
            pattern: pattern instanceof RegExp ? pattern.source : pattern,
            response,
        }));
        finalPromptHandler.setRules(rules);
    }
    
    const session = new PtySession(sandbox, worker, finalAdapter, finalPromptHandler);
    sandbox.registerSession(session);
    
    const startupCmd = finalAdapter.getStartupCommand();
    const [name, ...baseArgs] = startupCmd.split(' ');
    
    const actualName = (finalOptions as any)?.name || name;
    const actualArgs = (finalOptions as any)?.args 
        ? [...(actualName === name ? baseArgs : []), ...(finalOptions as any).args] 
        : baseArgs;
    
    console.log(`[PtySession] Spawning with name: ${actualName}, args: ${JSON.stringify(actualArgs)}`);
    
    await session.initializeSession({
        name: actualName,
        args: [actualName, ...actualArgs],
        env: finalOptions?.env
    });
    
    return session;
  }


  private async initializeSession(spawnOptions?: { name?: string, args?: string[], env?: Record<string, string> }): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.queue.push({
        execute: async () => {
          if (this.state !== SessionState.UNINITIALIZED) return;
          
          this.state = SessionState.SPAWNING;
          try {
            const env = Object.entries({ 
              ...this.sandbox.config.envVars,
              ...spawnOptions?.env,
              TERM: 'xterm-color',
              COLUMNS: '80',
              LINES: '30'
            }).map(([k, v]) => `${k}=${v}`);

            const cwd = this.sandbox.isSimulation ? (this.sandbox.simulationDir || process.cwd()) : undefined;
            if (cwd && !existsSync(cwd)) {
              mkdirSync(cwd, { recursive: true });
            }

            const driverType = this.sandbox.isSimulation ? 'simulation' : 'docker';
              const containerId = !this.sandbox.isSimulation ? this.sandbox.getContainer()?.id : undefined;


            await this.sendRequest('spawn', {
              driverType,
              containerId,
              options: {
                name: spawnOptions?.name,
                args: spawnOptions?.args,
                env: env,
                cwd: cwd,
              }
            });

            this.state = SessionState.READY;
            } catch (e: any) {
            this.state = SessionState.CLOSED;
            throw new PtySessionClosedError(mapSpawnErrorToRca(e));
          }

        },
        resolve,
        reject
      });
      this.processQueue();
    });
  }

  public static normalize(data: string, keepAnsi: boolean = false, writtenCommands: string[] = []): string {
    return AnsiProcessor.normalize(data, keepAnsi, writtenCommands);
  }

  public async initialize(): Promise<void> {
    // Wait for the queue to be empty or at least for the init task to finish.
    // Since initialize() is usually called before write(), we can just check state.
    // To be safe, we can queue a no-op task.
    return new Promise<void>((resolve, reject) => {
      this.queue.push({
        execute: async () => {
          if (this.state === SessionState.CLOSED) {
            return; // Resolve silently if already closed
          }
          if (this.state === SessionState.UNINITIALIZED) {
            throw new PtySessionClosedError();
          }
        },
        resolve,
        reject
      });
      this.processQueue();
    });
  }


  public onData(callback: (data: string) => void): void {
    this.dataCallbacks.push(callback);
  }

  public onRawData(callback: (data: string) => void): void {
    this.rawDataCallbacks.push(callback);
  }

  public async write(data: string): Promise<boolean> {
    if (this.state === SessionState.CLOSING || this.state === SessionState.CLOSED) {
      return false;
    }

    return new Promise<boolean>((resolve) => {
      this.queue.push({
        execute: async () => {
          if (this.state === SessionState.CLOSED) return false;

          if (this.state !== SessionState.READY) {
            return false;
          }
          
          let finalData = data;
          finalData = finalData.replace(/([^\r])\n/g, '$1\r\n').replace(/^\n/g, '\r\n');

          try {
            this.writtenCommands.push(finalData);
            await this.sendRequest('write', finalData);
            return true;
          } catch (e: any) {
            return false;
          }
        },
        resolve,
        reject: () => resolve(false) // Ensure we never reject the write promise
      });
      this.processQueue();
    });
  }

  public async injectResponse(data: string): Promise<void> {
    if (this.state === SessionState.CLOSING || this.state === SessionState.CLOSED) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      this.queue.push({
        execute: async () => {
          if (this.state === SessionState.CLOSED) return;
           await this.sendRequest('injectData', data + '\n');
        },
        resolve,
        reject
      });
      this.processQueue();
    });
  }

  public async close(): Promise<void> {
    if (this.state === SessionState.CLOSING || this.state === SessionState.CLOSED) return;
    
    this.state = SessionState.CLOSING;
    
    return new Promise<void>((resolve, reject) => {
      this.queue.push({
        execute: async () => {
          try {
            await this.sendRequest('close', {});
          } catch (e) {}
          this.state = SessionState.CLOSED;
          this.worker.terminate();
          this.sandbox.unregisterSession(this);
        },
        resolve,
        reject
      });
      this.processQueue();
    });
  }

  public getScreenState(): string {
    return this.screen.toString().split('\n').map(line => line.trimEnd()).join('\n');
  }

  public async waitForExit(): Promise<number> {
    await this.initialize();
    
    if (this.exitCode !== null) return this.exitCode;
    if (this.exitPromise) return this.exitPromise;

    this.exitPromise = new Promise((resolve) => {
      this.exitResolver = resolve;
    });

    return this.exitPromise;
  }

  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    console.log(`[PtySession] Processing queue...`);

    try {
      while (this.queue.length > 0) {
        const task = this.queue.shift()!;
        console.log(`[PtySession] Executing task: ${task.execute.name || 'anonymous'}`);
        try {
          const result = await task.execute();
          task.resolve(result);
        } catch (err) {
          task.reject(err);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}
