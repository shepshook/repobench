import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IPtySession } from '../../src/core/contracts';
import { PtySession } from '../../src/infrastructure/pty-session';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { VolumeManager } from '../../src/infrastructure/volume-manager';
import Docker from 'dockerode';
import { waitForText } from '../../src/infrastructure/pty/test-utils';

describe('PtySession Simulation Mode', () => {
  let sandbox: Sandbox;
  let volumeManager: VolumeManager;
  let docker: Docker;

  beforeEach(async () => {
    docker = new Docker();
    volumeManager = new VolumeManager(docker);
    // Create sandbox in simulation mode
    sandbox = new Sandbox({
      project: 'pty-sim-test',
      baseImage: 'node:20-alpine' // This should be ignored in simulation mode
    }, volumeManager);
    
    // Manually set isSimulation to true since Sandbox constructor doesn't set it
    // (Assuming Sandbox has an isSimulation property)
    (sandbox as any).isSimulation = true;
    (sandbox as any)._simulationDir = 'D:\\temp\\repobench-sim';

    
    // Note: we don't call sandbox.init() if it tries to create Docker containers
    // But we need to ensure simulationDir exists.
  });

  afterEach(async () => {
    await sandbox.destroy();
  });

  it('should spawn bash on Linux in simulation mode', async () => {
    const session: IPtySession = await PtySession.create(sandbox);
    try {
      session.write('echo $HOME\n');
      
      const home = process.env.HOME || '/home/user';
      await waitForText(session, home);
      expect(session.getScreenState()).toContain(home);
    } finally {
      await session.close();
    }
  });
 
 
  it('should successfully close a simulation session', async () => {
    const session: IPtySession = await PtySession.create(sandbox);
    try {
      await expect(session.close()).resolves.not.toThrow();
      
      await expect(session.write('test')).resolves.toBe(false);
    } finally {
      await session.close();
    }
  });
});
