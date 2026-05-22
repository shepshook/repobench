import path from 'path';
import { IDockerContainer, IDockerStream, IDockerExecOptions } from '../core/contracts';

export interface PtySpawnOptions {
  args?: string[];
  user?: string;
  env?: Record<string, string | undefined>;
  cwd?: string;
}

export abstract class PtyDriver {
  protected dataCallback: ((data: Uint8Array) => void) | null = null;
  protected exitCallback: ((code: number) => void) | null = null;

  public onData(cb: (data: Uint8Array) => void): void {
    this.dataCallback = cb;
  }

  public onExit(cb: (code: number) => void): void {
    this.exitCallback = cb;
  }

  public abstract spawn(options: PtySpawnOptions): Promise<void>;
  public abstract write(data: string): Promise<void>;
  public abstract close(): Promise<void>;
}

export class SimulationDriver extends PtyDriver {
  private writtenCommands: string[] = [];
  private waitingForInput = false;
  private inputVar = '';
  private pendingCommand = '';
  
  public cwd = '/home/user';
  public env: Record<string, string | undefined> = { ...process.env };
  private fs: Map<string, { type: 'dir' | 'file', content?: string }> = new Map([
    ['/', { type: 'dir' }],
    ['/home', { type: 'dir' }],
    ['/home/user', { type: 'dir' }],
  ]);

  private static commandRegistry: Record<string, (args: string[], driver: SimulationDriver) => string | void> = {
    'echo': (args, driver) => {
      let content = args.join(' ');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      content = content.replace(/%(\w+)%/g, (_, name) => driver.env[name] || '');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      content = content.replace(/\$(\w+)/g, (_, name) => driver.env[name] || '');
      return content + '\n';
    },
    'pwd': (_, driver) => driver.cwd + '\n',
    'cd': (args, driver) => {
      const target = args.length === 0 ? '/home/user' : args[0];
      const newPath = path.posix.resolve(driver.cwd, target);
      if (driver.fs.get(newPath)?.type === 'dir') {
        driver.cwd = newPath;
        return '';
      }
      return `cd: ${target}: No such directory\n`;
    },
    'mkdir': (args, driver) => {
      if (args.length === 0) return 'mkdir: missing operand\n';
      const target = path.posix.resolve(driver.cwd, args[0]);
      if (driver.fs.has(target)) return `mkdir: cannot create directory '${args[0]}': File exists\n`;
      
      const parent = path.posix.dirname(target);
      if (driver.fs.get(parent)?.type !== 'dir') {
        return `mkdir: cannot create directory '${args[0]}': No such file or directory\n`;
      }
      
      driver.fs.set(target, { type: 'dir' });
      return '';
    },
    'ver': () => 'Microsoft Windows [Version 10.0.19045.4412]\n',
    'uname': () => 'Linux\n',
    'ls': (args, driver) => {
      const target = args.length === 0 ? driver.cwd : path.posix.resolve(driver.cwd, args[0]);
      const entry = driver.fs.get(target);
      if (!entry || entry.type !== 'dir') return `ls: cannot access '${target}': No such directory or file\n`;
      
      const children = Array.from(driver.fs.keys())
        .filter(p => p.startsWith(target + '/') && p.split('/').filter(Boolean).length === target.split('/').filter(Boolean).length + 1)
        .map(p => path.posix.basename(p) + (driver.fs.get(p)?.type === 'dir' ? '/' : ''));
      
      return children.sort().join('\n') + (children.length > 0 ? '\n' : '');
    },
    'dir': (args, driver) => {
      // On Windows 'dir' is similar to 'ls' but formatted differently. 
      // For simplicity in simulation, we'll make it similar to ls.
      return SimulationDriver.commandRegistry['ls'](args, driver);
    },
    'cat': (args, driver) => {
      if (args.length === 0) return 'cat: missing file\n';
      const target = path.posix.resolve(driver.cwd, args[0]);
      const entry = driver.fs.get(target);
      if (!entry || entry.type !== 'file') return `cat: ${args[0]}: No such file or directory\n`;
      return (entry.content || '') + '\n';
    },
    'type': (args, driver) => {
      return SimulationDriver.commandRegistry['cat'](args, driver);
    },
  };

  public spawn(options: PtySpawnOptions): Promise<void> {
    if (options.cwd) this.cwd = options.cwd;
    if (options.env) this.env = { ...this.env, ...options.env };
    return Promise.resolve();
  }

  public async write(data: string): Promise<void> {
    this.writtenCommands.push(data);

    if (this.waitingForInput) {
      const inputValue = data.trim();
      let output = this.pendingCommand;
      if (!output) {
        output = 'echo "input: ' + inputValue + '"';
      }
      output = output.replace(new RegExp(`\\$${this.inputVar}`, 'g'), inputValue);
      
      this.waitingForInput = false;
      this.inputVar = '';
      this.pendingCommand = '';

      return this.executeCommand(output);
    }

    const trimmedData = data.trim();
    if (!trimmedData) return;

    const readMatch = trimmedData.match(/^read\s+(\w+);?\s*(.*)$/);
    if (readMatch) {
      this.waitingForInput = true;
      this.inputVar = readMatch[1];
      this.pendingCommand = readMatch[2];
      return; 
    }

    if (trimmedData === 'exit') {
      void this.close();
      return;
    }

    return this.executeCommand(trimmedData);
  }

  private executeCommand(commandLine: string): Promise<void> {
    const parts = commandLine.trim().split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    let output = '';
    const handler = SimulationDriver.commandRegistry[cmd];
    if (handler) {
      const result = handler(args, this);
      if (result !== undefined) {
        output = result;
      }
    } else {
      output = commandLine + '\n';
    }

    if (this.dataCallback && output) {
      this.dataCallback(new TextEncoder().encode(output));
    }
    return Promise.resolve();
  }

  public close(): Promise<void> {
    if (this.exitCallback) {
      this.exitCallback(0);
    }
    return Promise.resolve();
  }
}

export class DockerDriver extends PtyDriver {
  private container: IDockerContainer;
  private stream: IDockerStream | null = null;

  constructor(container: IDockerContainer) {
    super();
    this.container = container;
  }

  public async spawn(options: PtySpawnOptions): Promise<void> {
    const execOpts: IDockerExecOptions = {
      Cmd: options.args ?? ['/bin/sh', '-i'],
      Tty: true,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      User: options.user,
      Env: options.env ? Object.entries(options.env).map(([k, v]) => v !== undefined ? `${k}=${v}` : k) : undefined,
      WorkingDir: options.cwd,
    };

    const exec = await this.container.exec(execOpts);
    const stream = await exec.start({ hijack: true, stdin: true });
    this.stream = stream;

    stream.on('data', (data: Buffer) => {
      if (this.dataCallback) {
        this.dataCallback(new Uint8Array(data));
      }
    });

    stream.on('exit', (code: number) => {
      if (this.exitCallback) {
        this.exitCallback(code);
      }
    });
  }

  public write(data: string): Promise<void> {
    if (this.stream) {
      console.log(`[DockerDriver] Writing to shell: ${JSON.stringify(data)}`);
      this.stream.write(Buffer.from(data));
    }
    return Promise.resolve();
  }

  public close(): Promise<void> {
    if (this.stream) {
      this.stream.destroy();
    }
    return Promise.resolve();
  }
}
