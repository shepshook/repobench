"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_worker_threads_1 = require("node:worker_threads");
const dockerode_1 = __importDefault(require("dockerode"));
const pty_drivers_js_1 = require("../pty-drivers.cjs");
let driver = null;
const docker = new dockerode_1.default();
node_worker_threads_1.parentPort?.on('message', async (message) => {
    console.log(`[PtyWorker] Received request: ${message.type} (id: ${message.id})`);
    const { type, payload, id } = message;
    try {
        switch (type) {
            case 'spawn': {
                const { driverType, options, containerId } = payload;
                if (driverType === 'simulation') {
                    driver = new pty_drivers_js_1.SimulationDriver();
                }
                else if (driverType === 'docker') {
                    if (!containerId)
                        throw new Error('containerId is required for docker driver');
                    const container = docker.getContainer(containerId);
                    driver = new pty_drivers_js_1.DockerDriver(container);
                }
                else {
                    throw new Error(`Unknown driver type: ${driverType}`);
                }
                driver.onData((data) => {
                    console.log(`[PtyWorker] Emitting data: ${new TextDecoder().decode(data)}`);
                    node_worker_threads_1.parentPort?.postMessage({ type: 'data', data });
                });
                driver.onExit((code) => {
                    node_worker_threads_1.parentPort?.postMessage({ type: 'exit', code });
                });
                await driver.spawn(options);
                if (id) {
                    node_worker_threads_1.parentPort?.postMessage({ type: 'response', id, result: true });
                }
                break;
            }
            case 'write': {
                if (!driver)
                    throw new Error('PTY driver not spawned');
                await driver.write(payload);
                if (id) {
                    node_worker_threads_1.parentPort?.postMessage({ type: 'response', id, result: true });
                }
                break;
            }
            case 'injectData': {
                if (!driver) throw new Error('PTY driver not spawned');
                const data = typeof payload === 'string' ? payload : new TextDecoder().decode(payload);
                await driver.write(data);
                if (id) {
                    node_worker_threads_1.parentPort?.postMessage({ type: 'response', id, result: true });
                }
                break;
            }
            case 'close': {
                if (driver) {
                    await driver.close();
                    driver = null;
                }
                if (id) {
                    node_worker_threads_1.parentPort?.postMessage({ type: 'response', id, result: true });
                }
                break;
            }
            default:
                throw new Error(`Unknown message type: ${type}`);
        }
    }
    catch (error) {
        const errorMessage = error?.message ?? String(error);
        if (id) {
            node_worker_threads_1.parentPort?.postMessage({ type: 'response', id, error: errorMessage });
        }
        else {
            console.error('PTY Worker error:', error);
            node_worker_threads_1.parentPort?.postMessage({ type: 'error', error: errorMessage });
        }
    }
});
