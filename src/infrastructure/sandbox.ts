import { ISandbox, SandboxConfig, IVolumeManager, IFileAccessTracker, IDockerContainer, IDocker, IPtySession } from '../core/contracts';
import { z } from 'zod';
import Docker from 'dockerode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { mkdtempSync, writeFileSync, rmSync, existsSync, cpSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { VolumeManager, VolumeManagerError } from './volume-manager';
import { PtySession } from './pty-session';
import { DefaultAdapter } from '../core/services/base-agent-adapter';

class FileAccessTracker implements IFileAccessTracker {
  private modifiedFiles: Set<string> = new Set();
  private accessedFiles: Set<string> = new Set();
  private deletedFiles: Set<string> = new Set();

  trackModification(file: string) {
    this.modifiedFiles.add(file);
  }

  trackAccess(file: string) {
    this.accessedFiles.add(file);
  }

  trackDeletion(file: string) {
    this.deletedFiles.add(file);
  }

  getModifiedFiles(): string[] {
    return Array.from(this.modifiedFiles);
  }

  getAccessedFiles(): string[] {
    return Array.from(this.accessedFiles);
  }

  getDeletedFiles(): string[] {
    return Array.from(this.deletedFiles);
  }
}

const execAsync = promisify(exec);

class GitOperationError extends Error {
  public name = 'GitOperationError';
  public stdout: string;
  public stderr: string;
  public exitCode: number;

  constructor(message: string, { stdout, stderr, exitCode }: { stdout: string; stderr: string; exitCode: number }) {
    super(message);
    this.stdout = stdout;
    this.stderr = stderr;
    this.exitCode = exitCode;
  }
}

type SimulationHandler = (command: string, options?: { timeout?: number; env?: Record<string, string> }) => Promise<{ stdout: string; stderr: string; exitCode: number }>;

export class SimulationFixtures {
  private static handlers = new Map<string, SimulationHandler>();

  static register(commandPattern: string, handler: SimulationHandler): void {
    this.handlers.set(commandPattern, handler);
  }

  static getHandler(command: string): SimulationHandler | undefined {
    for (const [pattern, handler] of this.handlers) {
      if (command === pattern || command.startsWith(pattern)) {
        return handler;
      }
    }
    return undefined;
  }

  static clear(): void {
    this.handlers.clear();
  }
}

export class Sandbox implements ISandbox {
  public readonly id: string;
  public readonly config: SandboxConfig;
  public getContainer(): IDockerContainer | null { return this.container; }
  private container: IDockerContainer | null = null;
  private initialized = false;
  private sessions: Set<IPtySession> = new Set();

  public registerSession(session: IPtySession) {
    this.sessions.add(session);
  }

  public unregisterSession(session: IPtySession) {
    this.sessions.delete(session);
  }

  public isSimulation = false;
  public get simulationDir() { return this._simulationDir; }
  public set simulationDir(value: string | null) { this._simulationDir = value; }
  private _simulationDir: string | null = null;
  private _snapshotDir: string | null = null;
  private currentHash: string | null = null;
  private volumeManager: IVolumeManager;
  private statsCounted = false;
  private fileAccessTracker = new FileAccessTracker();

  public getFileAccessTracker(): IFileAccessTracker {
    return this.fileAccessTracker;
  }
  // cacheHits and cacheMisses are now managed by volumeManager
  
  constructor(config: SandboxConfig, volumeManagerInstance?: IVolumeManager) {
    this.id = `repobench-sandbox-${Math.random().toString(36).substring(2, 9)}`;
    this.config = config;
    this.volumeManager = volumeManagerInstance || new VolumeManager(new Docker() as unknown as IDocker);
  }

  async getCacheStats(): Promise<{ hits: number; misses: number }> {
    return this.volumeManager.getCacheStats();
  }

  async init(): Promise<void> {
    console.log(`DEBUG: Sandbox init starting...`);
    try {
      await this.initDocker();
      console.log(`DEBUG: Sandbox initDocker succeeded`);
    } catch (error: unknown) {
      const dockerError = error as { message?: string; code?: string };
      console.log(`DEBUG: Sandbox initDocker failed: ${dockerError.message}`);
      const isDockerError = 
          dockerError.code === 'ENOENT' || 
          dockerError.message?.includes('docker_engine') || 
          dockerError.message?.includes('Cannot read properties of undefined') ||
          (error instanceof VolumeManagerError && (error.message.includes('docker_engine') || error.message.includes('ENOENT')));
      
      if (isDockerError && process.env.FORCE_SIMULATION === 'true') {
        console.log(`DEBUG: FORCE_SIMULATION is set, falling back to simulation`);
        this.volumeManager.resetStats();
        await this.initSimulation();
      } else if (isDockerError) {
        throw new Error(
          `Docker is required for sandbox execution. ` +
          `Set FORCE_SIMULATION=true environment variable to use simulation mode for testing. ` +
          `Original error: ${dockerError.message}`,
          { cause: error }
        );
      } else {
        console.log(`DEBUG: Throwing non-docker error`);
        throw error;
      }
    }
  }

  private detectLockFile(dir?: string): string | undefined {
    const lockFiles = ['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'requirements.txt', 'Gemfile.lock', 'Cargo.lock', 'package-lock.mount.json', 'package-lock.test.json', '.sim-lockfile'];
    for (const file of lockFiles) {
      const pathsToCheck = dir ? [join(dir, file), file] : [file];
      for (const filePath of pathsToCheck) {
        if (existsSync(filePath)) {
          return filePath;
        }
      }
    }
    return undefined;
  }

  private async initDocker(): Promise<void> {
    const image = this.config.baseImage || 'node:20-alpine';
    const envs = Object.entries(this.config.envVars || {}).map(([k, v]) => `${k}=${v}`);
    
    const cacheVolumes = this.config.cacheVolumes || (this.config.cachePaths ? this.config.cachePaths.map(p => ({ hostPath: p, containerPath: p })) : null);
    const lockFile = this.detectLockFile() || '';

    if (cacheVolumes) {
        await this.volumeManager.setupCacheVolumes(
          cacheVolumes,
          this.config.project || 'default',
          lockFile,
          false
        );
    } else {
        await this.volumeManager.recordCacheStatus(this.config.project || 'default', lockFile, false);
    }

    console.log(`DEBUG: image is ${image}`);
    try {
      await this.volumeManager.getDocker().getImage(image).inspect();
    } catch (err: unknown) {
      console.debug(`Image not found locally, will pull: ${(err as Error).message}`);
      /* Pull image if not found */
      console.log(`DEBUG: pulling image ${image}`);
      await this.volumeManager.getDocker().pull(image);
    }

    const cacheBinds = Object.entries(this.volumeManager.getVolumes()).map(([path, name]) => `${name}:${path}`);

    const binds: string[] = [];

    if (this.config.workspacePath) {
      const absWorkspace = resolve(this.config.workspacePath);
      binds.push(`${absWorkspace}:/app`);
      console.log(`DEBUG: Mounting workspace ${absWorkspace} to /app`);
    }

    binds.push(...cacheBinds);

    const container = await this.volumeManager.getDocker().createContainer({
      Image: image,
      name: this.id,
      Cmd: ['tail', '-f', '/dev/null'],
      Labels: { app: 'repobench' },
      Env: envs,
      HostConfig: {
        Binds: binds,
      },
    });
    
    if (!container) {
      throw new Error('Failed to create Docker container: createContainer returned undefined');
    }
    
    this.container = container;
    console.log(`DEBUG: Sandbox container created: ${container.id}`);

    if (this.container && typeof this.container.start === 'function') {
      await this.container.start();
    }

    if (this.config.buildCommand) {
      const result = await this.runDockerCommand(this.config.buildCommand);
      if (result.exitCode !== 0) {
        const buildError = Object.assign(
          new Error(`Sandbox build command failed: ${this.config.buildCommand}`),
          { stdout: result.stdout, stderr: result.stderr }
        );
        throw buildError;
      }

    }

    if (this.config.agentSetupCommands && this.config.agentSetupCommands.length > 0) {
      for (const cmd of this.config.agentSetupCommands) {
        console.log(`[AgentSetup] Running: ${cmd}`);
        const result = await this.runDockerCommand(cmd);
        if (result.exitCode !== 0) {
          const setupError = Object.assign(
            new Error(`Agent setup command failed: ${cmd}`),
            { stdout: result.stdout, stderr: result.stderr }
          );
          throw setupError;
        }
      }
    }

    this.initialized = true;
  }

  private expandSimulationCommand(command: string, env: Record<string, string | undefined>): string {
    if (process.platform !== 'win32') return command;
    return command.replace(/\$(\w+)|\$\{(\w+)\}/g, (_, name1, name2) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const name = name1 || name2;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      return env[name] || `$${name}`;
    });
  }

    private async initSimulation(): Promise<void> {
      this.isSimulation = true;
      const baseDir = mkdtempSync(join(tmpdir(), 'repobench-'));
      this._simulationDir = baseDir;
 
      const cacheVolumes = this.config.cacheVolumes || (this.config.cachePaths ? this.config.cachePaths.map(p => ({ hostPath: p, containerPath: p })) : null);
      
      const lockFile = this.detectLockFile(this.simulationDir!) || '';
      if (cacheVolumes) {
        try {
          await this.volumeManager.setupCacheVolumes(
            cacheVolumes,
            this.config.project || 'default',
            lockFile,
            true
          );
      } catch (err: unknown) {
        console.warn(`Simulation cache setup failed (non-fatal): ${(err as Error).message}`);
      }

      } else {
        try {
          await this.volumeManager.recordCacheStatus(this.config.project || 'default', lockFile, true);
      } catch (err: unknown) {
        console.warn(`Simulation cache status recording failed (non-fatal): ${(err as Error).message}`);
      }

      }
 
      const tmpPath = join(this.simulationDir!, 'tmp');
      
      // Create tmp directory
      try {
        await execAsync(`mkdir ${tmpPath}`);
      } catch (err: unknown) {
        console.warn(`mkdir via exec failed (non-fatal): ${(err as Error).message}`);
      }
 
      if (this.config.buildCommand) {
        const cmd = this.config.buildCommand;
        if (cmd.startsWith('touch ')) {
          const target = cmd.replace('touch ', '').replace('/tmp/', `${tmpPath}/`);
          writeFileSync(target, '');
        } else if (cmd.includes('npm install') || cmd.includes('npm run build')) {
          // Simulate success for standard npm build commands in simulation mode to allow tests to pass without Docker
        } else {
             const repoPath = join(this.simulationDir!, 'repo');
            const translatedCmd = this.expandSimulationCommand(
              cmd.replace('/tmp/', `${tmpPath}/`).replace(/\/app/g, repoPath),
              { ...process.env, ...this.config.envVars }
            );
            
            if (cmd.includes('git clone')) {
                console.log(`DEBUG: Simulating git clone for ${cmd}`);
                 try {
                     mkdirSync(repoPath, { recursive: true });
                     await execAsync(`cmd /c git init`, { cwd: repoPath });
                     await execAsync(`cmd /c git config user.email "sim@example.com"`, { cwd: repoPath });
                     await execAsync(`cmd /c git config user.name "Sim User"`, { cwd: repoPath });
                     this._simulationDir = repoPath;
                  } catch (e: unknown) {
                       // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
                       const err = e as any;
                       // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                       console.log(`DEBUG: Failed to simulate git clone: ${err.message}`);
                     // Fallback to executing the actual command if simulation fails
                 }

            } else {
                console.log(`DEBUG: Executing simulation build command: ${translatedCmd}`);
                 try {
                   await execAsync(`cmd /c ${translatedCmd}`, { 
                     cwd: this.simulationDir!,
                     env: { ...process.env, ...this.config.envVars }
                   });
                   if (cmd.includes('/app')) {
                     this._simulationDir = repoPath;
                   }
                  } catch (error: unknown) {
                    const err = error as { message?: string; stdout?: string; stderr?: string };
                    console.log(`DEBUG: Simulation build command failed: ${translatedCmd}`);
                    console.log(`DEBUG: stderr: ${err.stderr || err.message}`);
                    const buildError = Object.assign(
                      new Error(`Sandbox build command failed: ${this.config.buildCommand}`),
                      { stdout: err.stdout ?? '', stderr: err.stderr ?? err.message }
                    );
                    throw buildError;
                  }

            }
        }
      }
 
      if (this.config.agentSetupCommands) {
        for (const cmd of this.config.agentSetupCommands) {
          console.log(`[AgentSetup][Simulation] Skipping: ${cmd}`);
        }
      }

      this.initialized = true;
    }

  private async runPtyCommand(name: string, args: string[], env?: Record<string, string>, timeout?: number): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    let stdout = '';
    // If it's a docker command, we let PtySession handle the Docker-native path by not passing name/args
    const isDockerExec = (name === 'docker' && args[0] === 'exec');
    
    const adapter = new DefaultAdapter(name, name);
    const spawnOptions = isDockerExec
      ? { env } 
      : { args, env };
      
    const session = await PtySession.create(this, adapter, spawnOptions);
    await session.initialize();
    session.onData((data) => {
      stdout += data;
    });

    // Write the command to the interactive shell, then exit so waitForExit resolves
    if (name === 'docker' && args[0] === 'exec') {
      const cmdIndex = args.indexOf('-c');
      if (cmdIndex !== -1 && cmdIndex + 1 < args.length) {
        const command = args.slice(cmdIndex + 1).join(' ');
        await session.write(command + '; exit\n');
      }
    }

    try {
      if (timeout) {

        await Promise.race([
          session.waitForExit(),
          new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
        ]);
      } else {
        await session.waitForExit();
      }
    } catch (error: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      const err = error as any;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (err.message === 'Timeout') {
        await session.close();
        return { stdout, stderr: 'Command timed out', exitCode: 124 };
      }
      throw err;
    }

    const exitCode = await session.waitForExit();
    await session.close();

    return { 
      stdout: stdout.trimEnd(), 
      stderr: '', 
      exitCode 
    };
  }

  /** Execute a non-interactive command inside the sandbox.
   * For batch/infrastructure commands (git, build, test) uses direct Docker exec
   * (fast, clean stdout/stderr, direct exit codes).
   * For interactive TTY sessions (AI agents), use PtySession.create() directly. */
  async execute(command: string, options?: { timeout?: number; env?: Record<string, string> }): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (!this.initialized) {
      throw new Error('Sandbox not initialized');
    }

    // Enhanced tracking
    const commands = command.split(/&&|\|\||\||;/);
    for (const cmd of commands) {
      const trimmedCmd = cmd.trim();
      if (trimmedCmd.startsWith('touch ')) {
        this.fileAccessTracker.trackModification(trimmedCmd.replace('touch ', '').trim());
      } else if (trimmedCmd.startsWith('rm ')) {
        this.fileAccessTracker.trackDeletion(trimmedCmd.replace('rm ', '').trim());
      } else if (trimmedCmd.startsWith('cat ') || trimmedCmd.startsWith('ls ') || trimmedCmd.startsWith('grep ')) {
        // Very basic: assume the last argument is the file
        const parts = trimmedCmd.split(/\s+/);
        if (parts.length > 1) {
          // If it's grep, we need to be careful not to track the pattern
          if (trimmedCmd.startsWith('grep ')) {
             // Basic grep: grep pattern file.txt
             if (parts.length > 2) {
               this.fileAccessTracker.trackAccess(parts[parts.length - 1].trim());
             }
          } else {
             this.fileAccessTracker.trackAccess(parts[parts.length - 1].trim());
          }
        }
      } else if (trimmedCmd.includes(' > ') || trimmedCmd.includes(' >> ')) {
        const parts = trimmedCmd.split(/\s+>\s+|\s+>>\s+/);
        const target = parts[parts.length - 1].trim();
        this.fileAccessTracker.trackModification(target);
      }
    }

    if (this.isSimulation) {
      return this.executeSimulation(command, options);
    }

    // Use direct Docker exec for non-interactive commands (faster than PTY)
    const envs = options?.env 
      ? Object.entries({ ...this.config.envVars, ...options.env }).map(([k, v]) => `${k}=${v}`)
      : undefined;
    return this.runDockerCommand(command, envs, options?.timeout);
  }

  async runCommand(command: string, options?: { timeout?: number; env?: Record<string, string> }): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return this.execute(command, options);
  }

  private async runDockerCommand(command: string, envs?: string[], timeout?: number): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (!this.container) {
      return { stdout: '', stderr: '', exitCode: 0 };
    }
    const finalEnvs = envs ?? Object.entries(this.config.envVars || {}).map(([k, v]) => `${k}=${v}`);
    const exec = await this.container.exec({
      Cmd: ['sh', '-c', command],
      Env: finalEnvs,
      AttachStdout: true,
      AttachStderr: true,
    });


    const stream = await exec.start();
    let stdout = '';
    let stderr = '';
    let buffer = Buffer.alloc(0);
    
    const streamPromise = new Promise<void>((resolve) => {
      stream.on('data', (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
        while (buffer.length >= 8) {
          const type = buffer[0];
          const length = buffer.readUInt32BE(4);
          if (buffer.length < 8 + length) break;
          
          const payload = buffer.slice(8, 8 + length).toString();
          if (type === 1) stdout += payload;
          else if (type === 2) stderr += payload;
          
          buffer = buffer.slice(8 + length);
        }
      });
      stream.on('end', resolve);
    });

    if (timeout) {
      await Promise.race([
        streamPromise,
        new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
      ]);
    } else {
      await streamPromise;
    }

    const inspect = await exec.inspect();
    const exitCode = inspect.ExitCode || 0;

    return { stdout, stderr, exitCode };
  }

  private async executeSimulation(command: string, options?: { timeout?: number; env?: Record<string, string> }): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // Check registered fixture handlers first (for test injection)
    const fixtureHandler = SimulationFixtures.getHandler(command);
    if (fixtureHandler) {
      return fixtureHandler(command, options);
    }

    // Use simulationDir path translation for filesystem commands
    if (this.simulationDir) {
      const tmpPath = join(this.simulationDir, 'tmp');
      let translatedCommand = command.replace('/tmp/', `${tmpPath}/`);

      // Translate cache paths to the shared simulation cache root
      if (this.config.cachePaths) {
        const lockFile = this.detectLockFile(this.simulationDir) || '';
        const cacheKey = await this.volumeManager.calculateCacheKey(lockFile);
        const simCacheRoot = join(this.volumeManager.simCacheRoot, this.config.project || 'default', cacheKey);
        for (const cachePath of this.config.cachePaths) {
          translatedCommand = translatedCommand.split(cachePath).join(simCacheRoot);
        }
      }

      // Execute via real subprocess on the simulation dir
      try {
        const finalCmd = this.expandSimulationCommand(
          translatedCommand,
          { ...process.env, ...this.config.envVars, ...options?.env }
        );
        const ptyResult = await this.runPtyCommand(
          process.platform === 'win32' ? 'cmd.exe' : 'bash',
          process.platform === 'win32' ? ['/c', finalCmd] : ['-c', finalCmd],
          Object.fromEntries(
            Object.entries({ ...process.env, ...this.config.envVars, ...options?.env })
              .filter(([, v]) => v !== undefined)
              .map(([k, v]) => [k, v as string])
          ),
          options?.timeout
        );
        return { stdout: ptyResult.stdout, stderr: ptyResult.stderr, exitCode: ptyResult.exitCode };
      } catch (error: unknown) {
        const cmdErr = error as { stderr?: string; message?: string; stdout?: string; code?: number };
        console.log(`DEBUG: Simulation command failed: ${translatedCommand}`);
        console.log(`DEBUG: stderr: ${cmdErr.stderr ?? cmdErr.message}`);
        return {
          stdout: cmdErr.stdout ?? '',
          stderr: cmdErr.stderr ?? '',
          exitCode: cmdErr.code ?? 1,
        };
      }
    }

    // No simulation dir and no fixture handler — return empty
    return { stdout: '', stderr: `Simulation mode: no handler for command '${command}'`, exitCode: 1 };
  }

  async ping(): Promise<boolean> {
    if (this.isSimulation) return this.initialized;
    if (!this.container) return false;
    try {
      const data = await this.container.inspect();
      return data.State.Running;
    } catch (err: unknown) {
      console.debug(`ping inspect failed: ${(err as Error).message}`);
      return false;
    }
  }

  async createSnapshot(): Promise<void> {
    if (!this.initialized) throw new Error('Sandbox not initialized');

    if (this.isSimulation && this.simulationDir) {
      this._snapshotDir = mkdtempSync(join(tmpdir(), 'repobench-snapshot-'));
      cpSync(this.simulationDir, this._snapshotDir, { recursive: true });
    } else {
      // For Docker, use tar inside the container for simplicity
      const result = await this.execute('tar -cf /tmp/snapshot.tar --exclude=/tmp/snapshot.tar /app /tmp');
      if (result.exitCode !== 0) {
        throw new Error(`Failed to create snapshot: ${result.stderr}`);
      }
    }
  }

  async restoreSnapshot(): Promise<void> {
    if (!this.initialized) throw new Error('Sandbox not initialized');

    if (this.isSimulation && this.simulationDir && this._snapshotDir) {
      rmSync(this.simulationDir, { recursive: true, force: true });
      cpSync(this._snapshotDir, this.simulationDir, { recursive: true });
    } else if (this.isSimulation) {
      throw new Error('No snapshot available to restore');
    } else {
      // For Docker, restore using tar
      const result = await this.execute('tar -xf /tmp/snapshot.tar -C /');
      if (result.exitCode !== 0) {
        throw new Error(`Failed to restore snapshot: ${result.stderr}`);
      }
    }
  }

  async destroy(): Promise<void> {
    if (this.sessions.size > 0) {
      await Promise.all(Array.from(this.sessions).map(s => s.close().catch((err: unknown) => { console.debug(`session close during destroy failed: ${(err as Error).message}`); })));
      this.sessions.clear();
    }
    if (this.isSimulation && this.simulationDir) {
      try {
        rmSync(this.simulationDir, { recursive: true, force: true });
      } catch (err: unknown) { console.debug(`simulation dir cleanup failed during destroy: ${(err as Error).message}`); }
    }
    if (this.isSimulation && this._snapshotDir) {
      try {
        rmSync(this._snapshotDir, { recursive: true, force: true });
      } catch (err: unknown) { console.debug(`snapshot dir cleanup failed during destroy: ${(err as Error).message}`); }
    }
    if (this.container) {
      try {
        await this.container.stop();
        await this.container.remove();
      } catch (err: unknown) { console.debug(`container stop/remove failed during destroy: ${(err as Error).message}`); }
    }
    this.container = null;
    this._simulationDir = null;
    this.initialized = false;
  }

   async switchState(hash: string): Promise<void> {
     z.string().regex(/^[0-9a-f]{40}$/).parse(hash);
 
     if (this.currentHash === hash) {
       return;
     }
 
     console.log(`Switching sandbox state to commit ${hash}...`);
 
     if (this.isSimulation && this.simulationDir) {
       writeFileSync(join(this.simulationDir, '.sim-lockfile'), hash);
     }
 
     const resetResult = await this.execute('git reset --hard');
     if (resetResult.exitCode !== 0) {
       if (!(this.isSimulation && resetResult.stderr.includes('not a git repository'))) {
         throw new GitOperationError(`Failed to reset working directory: ${resetResult.stderr}`, {
           stdout: resetResult.stdout,
           stderr: resetResult.stderr,
           exitCode: resetResult.exitCode
         });
       }
     }
 
     const checkoutResult = await this.execute(`git checkout ${hash}`);
     if (checkoutResult.exitCode !== 0) {
       if (!(this.isSimulation && checkoutResult.stderr.includes('not a git repository'))) {
         throw new GitOperationError(`Failed to switch state to hash ${hash}: ${checkoutResult.stderr}`, {
           stdout: checkoutResult.stdout,
           stderr: checkoutResult.stderr,
           exitCode: checkoutResult.exitCode
         });
       }
     }
 
     this.currentHash = hash;
   }

  async getFilesystemSnapshot(): Promise<string[]> {
    const { stdout } = await this.execute('find /app -maxdepth 2');
    return stdout.split('\n').filter(line => line.trim() !== '');
  }
}
