import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IPtySession } from '../../src/core/contracts';
import { PtySession } from '../../src/infrastructure/pty-session';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { VolumeManager } from '../../src/infrastructure/volume-manager';
import Docker from 'dockerode';
import { waitForText } from '../../src/infrastructure/pty/test-utils';

describe('PtySession Synchronization Failure', () => {
  let sandbox: Sandbox;
  let volumeManager: VolumeManager;
  let docker: Docker;

  beforeEach(async () => {
    docker = new Docker();
    volumeManager = new VolumeManager(docker);
    sandbox = new Sandbox({
      baseImage: 'node:20-alpine',
      project: 'pty-sync-fail'
    }, volumeManager);
    await sandbox.init();
  });

  afterEach(async () => {
    await sandbox.destroy();
  });

  it('should fail synchronization when shell commands are slow', async () => {
    const session: IPtySession = await PtySession.create(sandbox);
    try {
      let accumulated = '';
      session.onData((data) => { accumulated += data; });

      // Slow down the first write
      await session.write('sleep 0.5 && echo "First"\n');
       // Inject immediately — use echo to produce visible output through Docker exec
       await session.injectResponse('echo "Injected Middle"');
      // Write the last one
      await session.write('echo "Last"\n');

      await waitForText(session, 'First');
      await waitForText(session, 'Last');

      const firstIdx = accumulated.indexOf('First');
      const midIdx = accumulated.indexOf('Injected Middle');
      const lastIdx = accumulated.indexOf('Last');

      expect(firstIdx).not.toBe(-1);
      expect(midIdx).not.toBe(-1);
      expect(lastIdx).not.toBe(-1);
      expect(accumulated).not.toContain('not found');

      console.log(`Indices - First: ${firstIdx}, Mid: ${midIdx}, Last: ${lastIdx}`);

      expect(firstIdx).toBeLessThan(midIdx);
      expect(midIdx).toBeLessThan(lastIdx);
    } finally {
      await session.close();
    }
  });
});
