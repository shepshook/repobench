"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DockerDriver = exports.SimulationDriver = exports.PtyDriver = void 0;
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
}
exports.PtyDriver = PtyDriver;
class SimulationDriver extends PtyDriver {
    constructor() {
        super(...arguments);
        this.writtenCommands = [];
    }
    async spawn(options) {
        // Simulation driver doesn't need real spawning
    }
    async write(data) {
        this.writtenCommands.push(data);
        if (this.dataCallback) {
            this.dataCallback(data);
        }
    }
    async close() {
        if (this.exitCallback) {
            this.exitCallback(0);
        }
    }
}
exports.SimulationDriver = SimulationDriver;
class DockerDriver extends PtyDriver {
    constructor(container) {
        super();
        this.container = container;
    }
    async spawn(options) {
        const exec = await this.container.exec({
            Cmd: options.args || ['/bin/sh'],
            Tty: true,
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            User: options.user,
            Env: options.env,
            WorkingDir: options.cwd
        });
        this.shellProcess = await exec.start();
        this.shellProcess.on('data', (data) => {
            if (this.dataCallback) {
                this.dataCallback(data.toString());
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
            await this.shellProcess.write(data);
        }
    }
    async close() {
        if (this.shellProcess) {
            await this.shellProcess.stop();
        }
    }
}
exports.DockerDriver = DockerDriver;
