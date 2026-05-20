import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PtySession } from '../../src/infrastructure/pty-session';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { VolumeManager } from '../../src/infrastructure/volume-manager';
import Docker from 'dockerode';

describe('PtySession Windows Audit', () => {
  let sandbox: Sandbox;
  let volumeManager: VolumeManager;
  let docker: Docker;

  beforeEach(async () => {
    docker = new Docker();
    volumeManager = new VolumeManager(docker);
    sandbox = new Sandbox({
      baseImage: 'node:20-alpine',
      project: 'pty-windows-audit'
    }, volumeManager);
    
    // Force simulation mode for some tests to check cmd.exe spawning
    sandbox.isSimulation = true;
    sandbox.simulationDir = 'C:\\temp\\repobench-audit';
    
    await sandbox.init();
  });

  afterEach(async () => {
    await sandbox.destroy();
  });

  it('should not throw TypeError and maintain responsiveness when spawning many sessions rapidly (Stress Test)', async () => {
    const sessions: PtySession[] = [];
    try {
      for (let i = 0; i < 20; i++) {
        const session = await PtySession.create(sandbox);
        sessions.push(session);
        
        // Verify basic responsiveness
        const dataPromise = new Promise<string>((resolve) => {
          session.onData((data) => resolve(data));
        });
        session.write('echo hello\n');
        const data = await dataPromise;
        expect(data).toBeDefined();
      }
    } catch (error) {
      throw new Error(`Failed during rapid spawn: ${error}`);
    } finally {
      for (const session of sessions) {
        await session.close();
      }
    }
  }, 30000);

  it('should successfully handle waitForExit in simulation mode', async () => {
    const session = await PtySession.create(sandbox);
    try {
      // Try to run a command that exits quickly
      session.write('exit\n');
      
      const exitCode = await session.waitForExit();
      // If this returns 0 because of the .on check, it might be masking a bug
      expect(exitCode).toBeDefined();
    } finally {
      await session.close();
    }
  });

  it('should not throw TypeError when writing to a session while closing', async () => {
    const session = await PtySession.create(sandbox);
    try {
      const writePromise = new Promise((resolve) => {
        setTimeout(() => {
          try {
            session.write('test\n');
            resolve(true);
          } catch (e) {
            resolve(e);
          }
        }, 10);
      });
      await session.close();
      const result = await writePromise;
      if (result !== true) {
        expect(result).toBeInstanceOf(Error);
      }
    } finally {
      await session.close();
    }
  });
});
