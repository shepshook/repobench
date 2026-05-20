import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IPtySession } from '../../src/core/contracts';
import { PtySession } from '../../src/infrastructure/pty-session';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { VolumeManager } from '../../src/infrastructure/volume-manager';
import Docker from 'dockerode';

describe('PtySession Simulation Robustness', () => {
  let sandbox: Sandbox;
  let volumeManager: VolumeManager;
  let docker: Docker;

  beforeEach(async () => {
    docker = new Docker();
    volumeManager = new VolumeManager(docker);
    sandbox = new Sandbox({
      project: 'pty-sim-robust-test',
      baseImage: 'node:20-alpine'
    }, volumeManager);
    
    (sandbox as any).isSimulation = true;
    (sandbox as any)._simulationDir = 'D:\\temp\\repobench-sim-robust';
  });

  afterEach(async () => {
    await sandbox.destroy();
  });

  it('should use sh and not cmd.exe on Linux', async () => {
    const session: IPtySession = await PtySession.create(sandbox);
    try {
      const outputPromise = new Promise<string>((resolve) => {
        session.onData((data) => {
          // Linux supports 'uname', cmd.exe does not
          if (data.includes('Linux')) {
            resolve(data);
          } else if (data.includes('cmd.exe')) {
            resolve('cmd-detected');
          }
        });
      });
      
      session.write('uname\n');
      
      const result = await outputPromise;
      expect(result).not.toBe('cmd-detected');
      expect(result).toMatch(/Linux/);
    } finally {
      await session.close();
    }
  });
 
 
  it('should handle simulation session creation and immediate closure', async () => {
    const session: IPtySession = await PtySession.create(sandbox);
    try {
      await session.close();
      await expect(session.write('test')).resolves.toBe(false);
    } finally {
      await session.close();
    }
  });

  it('should maintain state in simulation mode', async () => {
    const session: IPtySession = await PtySession.create(sandbox);
    try {
      const outputPromise = new Promise<string>((resolve) => {
        session.onData((data) => {
          if (data.includes('sim-state-file')) {
            resolve(data);
          }
        });
      });

      session.write('echo "state" > sim-state-file.txt\n');
      session.write('type sim-state-file.txt\n');
      
      const result = await outputPromise;
      expect(result).toContain('state');
    } finally {
      await session.close();
    }
  });
});
