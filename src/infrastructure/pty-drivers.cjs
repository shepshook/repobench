"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DockerDriver = exports.SimulationDriver = exports.PtyDriver = void 0;

const path = require('path');

class PtyDriver {
    constructor() {
        this.dataCallback = null;
        this.exitCallback = null;
    }
    onData(cb) {
        this.dataCallback = cb;
    }
    onExit(cb) {
        this.exitCallback = cb;
    }
    async spawn(_options) { throw new Error("Not implemented"); }
    async write(_data) { throw new Error("Not implemented"); }
    async close() { throw new Error("Not implemented"); }
}
exports.PtyDriver = PtyDriver;

class SimulationDriver extends PtyDriver {
    constructor() {
        super();
        this.writtenCommands = [];
        this.waitingForInput = false;
        this.inputVar = '';
        this.pendingCommand = '';
        this.cwd = '/home/user';
        this.env = { ...process.env };
        this.fs = new Map([
            ['/', { type: 'dir' }],
            ['/home', { type: 'dir' }],
            ['/home/user', { type: 'dir' }],
        ]);
    }

    async spawn(options) {
        if (options.cwd) this.cwd = options.cwd;
        if (options.env) this.env = { ...this.env, ...options.env };
    }

    async write(data) {
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
            this.close();
            return;
        }

        return this.executeCommand(trimmedData);
    }

    async executeCommand(commandLine) {
        const shellOpMatch = commandLine.match(/^(.*?)\s*(&&|\|\||;)\s*(.*)$/);
        if (shellOpMatch) {
            const [, first, , rest] = shellOpMatch;
            const firstResult = this.executeSingle(first.trim());
            if (firstResult.output !== undefined && this.dataCallback && firstResult.output) {
                this.dataCallback(new TextEncoder().encode(firstResult.output));
            }
            if (shellOpMatch[2] === '&&' && firstResult.exitCode !== 0) return;
            if (shellOpMatch[2] === '||' && firstResult.exitCode === 0) return;
            return this.executeCommand(rest.trim());
        }

        const { output } = this.executeSingle(commandLine.trim());
        if (this.dataCallback && output) {
            this.dataCallback(new TextEncoder().encode(output));
        }
    }

    executeSingle(commandLine) {
        const parts = commandLine.trim().split(/\s+/);
        const cmd = parts[0];
        const args = parts.slice(1);

        const handler = SimulationDriver.commandRegistry[cmd];
        if (handler) {
            const result = handler(args, this);
            if (result !== undefined) {
                return { output: result, exitCode: 0 };
            }
            return { output: '', exitCode: 0 };
        }
        return { output: commandLine + '\n', exitCode: 0 };
    }

    async close() {
        if (this.exitCallback) {
            this.exitCallback(0);
        }
    }
}

SimulationDriver.commandRegistry = {
    'echo': (args, driver) => {
        let content = args.join(' ');
        content = content.replace(/%(\w+)%/g, (_, name) => driver.env[name] || '');
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
    'sleep': () => '',
    'dir': (args, driver) => {
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
exports.SimulationDriver = SimulationDriver;

class DockerDriver extends PtyDriver {
    constructor(container) {
        super();
        this.container = container;
    }
    async spawn(options) {
        const exec = await this.container.exec({
            Cmd: options.args || ['/bin/sh', '-i'],
            Tty: true,
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            User: options.user,
            Env: options.env,
            WorkingDir: options.cwd
        });

        this.shellProcess = await exec.start({ hijack: true, stdin: true });

        this.shellProcess.on('data', (data) => {
            if (this.dataCallback) {
                let buffer = Buffer.from(data);
                if (buffer.length >= 8 && buffer[0] === 1 && buffer[1] === 0 && buffer[2] === 0) {
                    buffer = buffer.slice(8);
                }
                this.dataCallback(new Uint8Array(buffer));
            }
        });

        this.shellProcess.on('exit', (code) => {
            if (this.exitCallback) {
                this.exitCallback(code);
            }
        });
    }
    async write(data) {
        if (this.shellProcess) {
            console.log(`[DockerDriver] Writing to shell: ${JSON.stringify(data)}`);
            await this.shellProcess.write(Buffer.from(data));
        }
    }
    async close() {
        if (this.shellProcess) {
            await this.shellProcess.destroy();
        }
    }
}
exports.DockerDriver = DockerDriver;
