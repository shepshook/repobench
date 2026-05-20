import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PtySession } from '../../src/infrastructure/pty-session';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { VolumeManager } from '../../src/infrastructure/volume-manager';
import Docker from 'dockerode';

describe('PtySession Initialization', () => {
  let sandbox: Sandbox;
  let volumeManager: VolumeManager;
  let docker: Docker;

  beforeEach(async () => {
    docker = new Docker();
    volumeManager = new VolumeManager(docker);
    sandbox = new Sandbox({
      baseImage: 'node:20-alpine',
      project: 'pty-init-test'
    }, volumeManager);
    await sandbox.init();
  });

  afterEach(async () => {
    await sandbox.destroy();
  });

  it('should not throw TypeError when writing immediately after construction', async () => {
    const session = await PtySession.create(sandbox);
    try {
      // Try to write immediately without awaiting anything else
      expect(() => session.write('ls\n')).not.toThrow();
      
      // Now wait for some output to ensure it actually worked
      const outputPromise = new Promise<string>((resolve) => {
        session.onData((data) => {
          if (data.length > 0) resolve(data);
        });
      });

      session.write('echo "ready"\n');
      const output = await outputPromise;
      expect(output).toBeDefined();
    } finally {
      await session.close();
    }
  });

  it('should handle multiple rapid writes', async () => {
    const session = await PtySession.create(sandbox);
    try {
      expect(() => {
        session.write('echo 1\n');
        session.write('echo 2\n');
        session.write('echo 3\n');
      }).not.toThrow();

      const outputPromise = new Promise<string>((resolve) => {
        let accumulated = '';
        session.onData((data) => {
          accumulated += data;
          if (accumulated.includes('3')) resolve(accumulated);
        });
      });

      const output = await outputPromise;
      expect(output).toContain('1');
      expect(output).toContain('2');
      expect(output).toContain('3');
    } finally {
      await session.close();
    }
  });
});
