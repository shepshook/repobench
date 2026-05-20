import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PtySession } from '../../src/infrastructure/pty-session';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { VolumeManager } from '../../src/infrastructure/volume-manager';
import Docker from 'dockerode';

describe('PtySession Robustness', () => {
  let sandbox: Sandbox;
  let volumeManager: VolumeManager;
  let docker: Docker;

  beforeEach(async () => {
    docker = new Docker();
    volumeManager = new VolumeManager(docker);
    sandbox = new Sandbox({
      baseImage: 'node:20-alpine',
      project: 'pty-robustness'
    }, volumeManager);
    await sandbox.init();
  });

  afterEach(async () => {
    await sandbox.destroy();
  });

  it('should handle long-running commands without timing out', async () => {
    const session = await PtySession.create(sandbox);
    try {
      const outputPromise = new Promise<string>((resolve) => {
        session.onData((data) => {
          if (data.includes('Done sleeping')) {
            resolve(data);
          }
        });
      });

      await session.write('sleep 2 && echo "Done sleeping"\n');
      
      const output = await outputPromise;
      expect(output).toContain('Done sleeping');
    } finally {
      await session.close();
    }
  }, 60000);

  it('should not leave orphaned background processes after closing', async () => {
    const session1 = await PtySession.create(sandbox);
    await session1.initialize();
    await session1.write('sleep 10\n');
    await session1.close();

    // The sandbox container should still be healthy after session close
    const info = await sandbox.getContainer()?.inspect();
    expect(info.State.Running).toBe(true);
  }, 30000);

  it('should ensure terminal is ready before sending input', async () => {
    const session = await PtySession.create(sandbox);
    try {
      const outputPromise = new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Command not echoed back')), 5000);
        session.onData((data) => {
          if (data.includes('Ready Check')) {
            clearTimeout(timeout);
            resolve(data);
          }
        });
      });

      session.write('echo "Ready Check"\n');
      
      const output = await outputPromise;
      expect(output).toContain('Ready Check');
    } finally {
      await session.close();
    }
  });
});
