import { parentPort } from 'node:worker_threads';
import Docker from 'dockerode';
import { PtyDriver, SimulationDriver, DockerDriver } from '../pty-drivers.js';
import { PtyRequest, PtyResponseSuccess, PtyResponseError, PtyResponseData, PtyResponseExit } from './types';

let driver: PtyDriver | null = null;
const docker = new Docker();

parentPort?.on('message', async (message: PtyRequest) => {
  console.log(`[PtyWorker] Received request: ${message.type} (id: ${message.id})`);
  const { type, payload, id } = message;

  try {
    switch (type) {
      case 'spawn': {
        const { driverType, options, containerId } = payload;
        
        if (driverType === 'simulation') {
          driver = new SimulationDriver();
        } else if (driverType === 'docker') {
          if (!containerId) throw new Error('containerId is required for docker driver');
          const container = docker.getContainer(containerId);
          driver = new DockerDriver(container);
        } else {
          throw new Error(`Unknown driver type: ${driverType}`);
        }

        driver.onData((data) => {
          console.log(`[PtyWorker] Emitting data: ${new TextDecoder().decode(data)}`);
          parentPort?.postMessage({ type: 'data', data } as PtyResponseData);
        });

        driver.onExit((code) => {
          parentPort?.postMessage({ type: 'exit', code } as PtyResponseExit);
        });

        await driver.spawn(options);
        
        if (id) {
          parentPort?.postMessage({ type: 'response', id, result: true } as PtyResponseSuccess);
        }
        break;
      }

      case 'write': {
        if (!driver) throw new Error('PTY driver not spawned');
        await driver.write(payload);
        if (id) {
          parentPort?.postMessage({ type: 'response', id, result: true } as PtyResponseSuccess);
        }
        break;
      }

      case 'close': {
        if (driver) {
          await driver.close();
          driver = null;
        }
        if (id) {
          parentPort?.postMessage({ type: 'response', id, result: true } as PtyResponseSuccess);
        }
        break;
      }

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error: any) {
    const errorMessage = error?.message ?? String(error);
    if (id) {
      parentPort?.postMessage({ type: 'response', id, error: errorMessage } as PtyResponseError);
    } else {
      console.error('PTY Worker error:', error);
      parentPort?.postMessage({ type: 'error', error: errorMessage });
    }
  }
});
