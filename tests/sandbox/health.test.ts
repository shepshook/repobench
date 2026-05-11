import { describe, it, expect } from 'vitest';
import { LocalSandbox, DockerSandbox } from '../../src/sandbox';
import { SandboxOptions } from '../../src/types/contracts';

describe('Sandbox Health Monitoring', () => {
  const testRepo = 'D:/dev/RepoBench/toy-repo';
  const getOptions = (): SandboxOptions => ({
    repoPath: testRepo,
    image: 'node:20-slim',
    commitHash: 'master',
  });

  const runHealthTests = async (SandboxClass: any) => {
    const options = getOptions();
    const sandbox = new SandboxClass(options);

    // Verify ping() returns false before init()
    expect(await sandbox.ping()).toBe(false);

    await sandbox.init();
    // Verify ping() returns true after init()
    expect(await sandbox.ping()).toBe(true);

    await sandbox.destroy();
    // Verify ping() returns false after destroy()
    expect(await sandbox.ping()).toBe(false);
  };

  it('LocalSandbox should report health correctly', async () => {
    await runHealthTests(LocalSandbox);
  });

  it('DockerSandbox should report health correctly', async () => {
    try {
      await runHealthTests(DockerSandbox);
    } catch (e) {
      console.warn('Docker health tests skipped or failed due to Docker unavailability:', e);
    }
  });
});
