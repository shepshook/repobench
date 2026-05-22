import { parentPort } from 'node:worker_threads';
import Docker from 'dockerode';
import { PtyDriver, SimulationDriver, DockerDriver } from '../pty-drivers.js';
import { PtyRequest } from './types';
import type { IDockerContainer } from '../../core/contracts';

let driver: PtyDriver | null = null;
const docker = new Docker();

parentPort?.on('message', (message: PtyRequest) => {
  void ((async () => {
  console.log(`[PtyWorker] Received request: ${message.type} (id: ${message.id})`);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { type, payload, id } = message;

  try {
    switch (type) {
      case 'spawn': {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { driverType, options, containerId } = payload;
        
        if (driverType === 'simulation') {
          driver = new SimulationDriver();
        } else if (driverType === 'docker') {
          if (!containerId) throw new Error('containerId is required for docker driver');
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          const container = docker.getContainer(containerId) as unknown as IDockerContainer;
          driver = new DockerDriver(container);
        } else {
          throw new Error(`Unknown driver type: ${driverType}`);
        }

        driver.onData((data) => {
          console.log(`[PtyWorker] Emitting data: ${new TextDecoder().decode(data)}`);
          parentPort?.postMessage({ type: 'data', data });
        });

        driver.onExit((code) => {
          parentPort?.postMessage({ type: 'exit', code });
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        await driver.spawn(options);
        
        if (id) {
          parentPort?.postMessage({ type: 'response', id, result: true });
        }
        break;
      }

      case 'write': {
        if (!driver) throw new Error('PTY driver not spawned');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        await driver.write(payload);
        if (id) {
          parentPort?.postMessage({ type: 'response', id, result: true });
        }
        break;
      }

      case 'close': {
        if (driver) {
          await driver.close();
          driver = null;
        }
        if (id) {
          parentPort?.postMessage({ type: 'response', id, result: true });
        }
        break;
      }

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (id) {
      parentPort?.postMessage({ type: 'response', id, error: errorMessage });
    } else {
      console.error('PTY Worker error:', error);
      parentPort?.postMessage({ type: 'error', error: errorMessage });
    }
  }
  })());
});
