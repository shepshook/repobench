import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PtySession } from '../../src/infrastructure/pty-session';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { VolumeManager } from '../../src/infrastructure/volume-manager';
import Docker from 'dockerode';

describe('Pty AttachConsole Reproduction', () => {
  let sandbox: Sandbox;
  let volumeManager: VolumeManager;

  beforeAll(async () => {
    const docker = new Docker();
    volumeManager = new VolumeManager(docker);
    sandbox = new Sandbox({
      baseImage: 'node:20-alpine',
      project: 'pty-attach-console-audit'
    }, volumeManager);
    
    // Use simulation mode to test Windows local PTY behavior (node-pty)
    sandbox.isSimulation = true;
    
    try {
      await sandbox.init();
    } catch (e) {
      console.log('Sandbox init failed, but we might still be able to spawn host PTYs');
    }
  });

  afterAll(async () => {
    await sandbox.destroy();
  });

  it('should not fail with AttachConsole when spawning multiple cmd.exe sessions', async () => {
    const sessions: PtySession[] = [];
    
    try {
      for (let i = 0; i < 10; i++) {
        const session = await PtySession.create(sandbox, { 
          name: 'cmd.exe', 
          args: ['/c', 'echo hello'] 
        });
        sessions.push(session);
        
        const dataPromise = new Promise<string>((resolve) => {
          session.onData((data) => resolve(data));
        });
        
        session.write('echo hello\n');
        await dataPromise;
      }
    } catch (error: any) {
      if (error.message && error.message.includes('AttachConsole')) {
        throw new Error(`Reproduced AttachConsole failure: ${error.message}`);
      }
      throw error;
    } finally {
      for (const session of sessions) {
        await session.close();
      }
    }
  }, 30000);

  it('should not throw TypeError during high-frequency PTY operations', async () => {
    const sessions: PtySession[] = [];
    try {
      for (let i = 0; i < 20; i++) {
        const session = await PtySession.create(sandbox, { 
          name: 'cmd.exe', 
          args: ['/c', 'echo hello'] 
        });
        sessions.push(session);
        
        // Mix writes and closes
        if (i % 2 === 0) {
          session.write('test\n');
        } else {
          session.close().catch(() => {});
        }
      }
      
      await Promise.all(sessions.map(async (s) => {
        try {
          s.write('closing\n');
          await s.close();
        } catch (e) {}
      }));
    } catch (error: any) {
      if (error instanceof TypeError) {
        throw new Error(`Reproduced TypeError: ${error.message}`);
      }
      throw error;
    } finally {
      for (const session of sessions) {
        await session.close();
      }
    }
  }, 30000);
});
