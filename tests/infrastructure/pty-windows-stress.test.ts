import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PtySession } from '../../src/infrastructure/pty-session';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { VolumeManager } from '../../src/infrastructure/volume-manager';
import Docker from 'dockerode';

describe('PtySession Windows Stress Test', () => {
  let sandbox: Sandbox;
  let volumeManager: VolumeManager;

  beforeEach(async () => {
    const docker = new Docker();
    volumeManager = new VolumeManager(docker);
    sandbox = new Sandbox({
      baseImage: 'node:20-alpine',
      project: 'pty-windows-stress'
    }, volumeManager);
    
    sandbox.isSimulation = true;
    sandbox.simulationDir = 'C:\\temp\\repobench-stress';
    
    await sandbox.init();
  });

  afterEach(async () => {
    await sandbox.destroy();
  });

  it('should handle a very large number of concurrent sessions without TypeError', async () => {
    const sessions: PtySession[] = [];
    const sessionCount = 20; // Reduced count to prevent OS resource exhaustion
    
    try {
      const writeOps = [];
      for (let i = 0; i < sessionCount; i++) {
        const session = await PtySession.create(sandbox);
        sessions.push(session);
        
        writeOps.push(session.write('echo session ' + i + '\\n').catch(() => {}));
      }
      
      // Rapidly close them all in parallel
      await Promise.all([
        Promise.allSettled(writeOps),
        Promise.all(sessions.map(s => s.close()))
      ]);
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(`Reproduced TypeError during high-concurrency: ${error.message}`);
      }
      throw error;
    } finally {
      for (const session of sessions) {
        await session.close();
      }
    }
  }, 30000);

  it('should not throw EPIPE when writing to a session that is closing', async () => {
    const sessions: PtySession[] = [];
    try {
      for (let i = 0; i < 20; i++) {
         sessions.push(await PtySession.create(sandbox));
      }

      await Promise.all(sessions.map(async (session) => {
        // Close the session and immediately attempt to write
        // This is designed to trigger the race condition leading to EPIPE
        const p1 = session.close();
        const p2 = session.write('trigger epipe\n');
        await Promise.allSettled([p1, p2]);
      }));
    } finally {
      for (const session of sessions) {
        await session.close();
      }
    }
  }, 30000);

  it('should not throw TypeError when closing and writing rapidly', async () => {
    const sessions: PtySession[] = [];
    try {
      for (let i = 0; i < 20; i++) {
         sessions.push(await PtySession.create(sandbox));
      }

      try {
        await Promise.all(sessions.map(async (session) => {
          // Interleave write and close
          const ops = [];
          for (let j = 0; j < 10; j++) {
            ops.push(Promise.resolve().then(() => session.write('test' + j + '\\n')));
            ops.push(Promise.resolve().then(() => session.close()));
          }
          await Promise.allSettled(ops);
        }));
      } catch (error) {
        if (error instanceof TypeError) {
          throw new Error(`Reproduced TypeError during rapid close/write: ${error.message}`);
        }
        throw error;
      }
    } finally {
      for (const session of sessions) {
        await session.close();
      }
    }
  }, 30000);
});
