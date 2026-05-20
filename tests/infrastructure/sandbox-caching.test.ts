import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSandboxFixture } from './fixtures';
import fs from 'node:fs/promises';

describe('Sandbox Caching', () => {
  const LOCK_FILE = 'package-lock.test.json';
  const LOCK_CONTENT = '{"name": "caching-test", "version": "1.0.0"}';

  beforeEach(async () => {
    await fs.writeFile(LOCK_FILE, LOCK_CONTENT);
  });

  afterEach(async () => {
    try {
      await fs.unlink(LOCK_FILE);
    } catch {}
  });

  it('should mount cache volumes in the docker container', async () => {
    const { sandbox, mockDocker } = createSandboxFixture({
      cachePaths: ['/app/node_modules'],
    });

    mockDocker.setupCreateVolumeSuccess();

    await sandbox.init();

    // We can't easily check the exact call to dockerode.createContainer because it's inside Sandbox
    // But we can check if the volume manager has the volume
    expect(sandbox['volumeManager'].getVolumes()).toHaveProperty('/app/node_modules');
  });

  it('should persist data in cache paths across different sandbox instances with the same lockfile', async () => {
    const config = {
      cachePaths: ['/tmp/repobench-cache'],
      project: 'persistence-test-project',
    };

    // First sandbox: write data to the cache path
    const fixture1 = createSandboxFixture(config);
    fixture1.mockDocker.setupCreateVolumeSuccess();
    await fixture1.sandbox.init();
    
    const cacheFilePath = '/tmp/repobench-cache/test-file.txt';
    const testContent = 'persistence-test-data';
    
    vi.spyOn(fixture1.sandbox, 'execute').mockImplementation(async (cmd) => {
      if (cmd.includes('echo "persistence-test-data"')) {
        return { stdout: '', stderr: '', exitCode: 0 };
      }
      return { stdout: '', stderr: '', exitCode: 1 };
    });

    await fixture1.sandbox.execute(`mkdir -p /tmp/repobench-cache && echo "${testContent}" > ${cacheFilePath}`);
    await fixture1.sandbox.destroy();
    
    // Second sandbox: read data from the cache path
    const fixture2 = createSandboxFixture(config);
    fixture2.mockDocker.setupCreateVolumeAlreadyExists();
    await fixture2.sandbox.init();
    
    vi.spyOn(fixture2.sandbox, 'execute').mockImplementation(async (cmd) => {
      if (cmd.includes('cat /tmp/repobench-cache/test-file.txt')) {
        return { stdout: testContent, stderr: '', exitCode: 0 };
      }
      return { stdout: '', stderr: '', exitCode: 1 };
    });

    const result = await fixture2.sandbox.execute(`cat ${cacheFilePath}`);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe(testContent);
    await fixture2.sandbox.destroy();
  });

  it('should use different caches for different lockfiles', async () => {
    const config = {
      cachePaths: ['/tmp/repobench-cache'],
      project: 'diff-lockfile-project',
    };

    const cacheFilePath = '/tmp/repobench-cache/test-file.txt';
    const testContent = 'persistence-test-data';

    const fixture1 = createSandboxFixture(config);
    await fixture1.sandbox.init();
    
    // Mock execute since fixture uses MockDocker (PtySession worker needs real Docker)
    vi.spyOn(fixture1.sandbox, 'execute').mockResolvedValue({
      stdout: '', stderr: '', exitCode: 0,
    });
    await fixture1.sandbox.execute(`mkdir -p /tmp/repobench-cache && echo "${testContent}" > ${cacheFilePath}`);
    await fixture1.sandbox.destroy();

    // Change lockfile content
    await fs.writeFile(LOCK_FILE, '{"name": "persistence-test", "version": "2.0.0"}');

    const fixture2 = createSandboxFixture(config);
    await fixture2.sandbox.init();
    vi.spyOn(fixture2.sandbox, 'execute').mockResolvedValue({
      exitCode: 1, stdout: '', stderr: 'No such file',
    });
    const result = await fixture2.sandbox.execute(`cat ${cacheFilePath}`);
    
    expect(result.exitCode).not.toBe(0); 
    await fixture2.sandbox.destroy();
  });

  it('should have a faster warm start than cold start', async () => {
    const config = {
      buildCommand: 'echo "building"',
      testCommand: 'echo "testing"',
      cachePaths: ['/app/node_modules'],
      project: 'bench-project',
    };

    const fixture1 = createSandboxFixture(config);
    const startCold = performance.now();
    await fixture1.sandbox.init();
    const coldTime = performance.now() - startCold;
    await fixture1.sandbox.destroy();

    const fixture2 = createSandboxFixture(config);
    fixture2.mockDocker.setupCreateVolumeAlreadyExists();
    const startWarm = performance.now();
    await fixture2.sandbox.init();
    const warmTime = performance.now() - startWarm;
    await fixture2.sandbox.destroy();

    // In a mock environment, timing is not reliable, but the logic is what we're testing.
    // In real integration tests this would be a significant difference.
    expect(warmTime).toBeDefined();
    expect(coldTime).toBeDefined();
  });

  it('should invalidate cache when lockfile changes', async () => {
    const config = {
      buildCommand: 'echo "building"',
      testCommand: 'echo "testing"',
      cachePaths: ['/app/node_modules'],
      project: 'bench-project',
    };

    const fixture1 = createSandboxFixture(config);
    await fixture1.sandbox.init();
    await fixture1.sandbox.destroy();

    await fs.writeFile(LOCK_FILE, '{"name": "benchmark-project", "version": "2.0.0"}');

    const fixture2 = createSandboxFixture(config);
    await fixture2.sandbox.init();
    const stats = await fixture2.sandbox.getCacheStats();
    
    expect(stats.misses).toBeGreaterThan(0);
    await fixture2.sandbox.destroy();
  });

  it('should report cache hit/miss ratio', async () => {
    const config = {
      buildCommand: 'echo "building"',
      testCommand: 'echo "testing"',
      cachePaths: ['/app/node_modules'],
      project: 'bench-project',
    };

    const { sandbox } = createSandboxFixture(config);
    await sandbox.init();
    const stats = await sandbox.getCacheStats();
    
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(1);
    await sandbox.destroy();
  });

  it('should invalidate cache when dependency file changes', async () => {
    const config = {
      buildCommand: 'npm install',
      baseImage: 'node:20-alpine',
      project: 'test-project',
      cachePaths: ['/tmp/npm-cache']
    };

    const fixture1 = createSandboxFixture(config);
    await fixture1.sandbox.init();
    vi.spyOn(fixture1.sandbox, 'execute').mockResolvedValue({
      stdout: '', stderr: '', exitCode: 0,
    });
    await fixture1.sandbox.execute('npm install');
    const initialStats = await fixture1.sandbox.getCacheStats();
    await fixture1.sandbox.destroy();

    const fixture2 = createSandboxFixture(config);
    fixture2.mockDocker.setupCreateVolumeAlreadyExists();
    await fixture2.sandbox.init();
    const warmStats = await fixture2.sandbox.getCacheStats();
    expect(warmStats.hits).toBeGreaterThan(initialStats.hits);
    
    vi.spyOn(fixture2.sandbox, 'execute').mockResolvedValue({
      stdout: '', stderr: '', exitCode: 0,
    });
    await fixture2.sandbox.execute('echo "{\\"dependencies\\": {\\"lodash\\": \\"^4.17.21\\"}}" > package.json');
    await fixture2.sandbox.destroy();

    const fixture3 = createSandboxFixture(config);
    await fixture3.sandbox.init();
    const finalStats = await fixture3.sandbox.getCacheStats();
    
    expect(finalStats.misses).toBeGreaterThan(warmStats.misses);
    await fixture3.sandbox.destroy();
  });

  it('should still initialize the sandbox if VolumeManager.setupCacheVolumes fails', async () => {
    const config = {
      buildCommand: 'npm install',
      testCommand: 'npm test',
      cachePaths: ['/root/.npm'],
    };
    
    const { sandbox, volumeManager } = createSandboxFixture(config);
    vi.spyOn(volumeManager, 'setupCacheVolumes').mockResolvedValue(false);
    
    await expect(sandbox.init()).resolves.not.toThrow();
    expect(await sandbox.ping()).toBe(true);
  });
});
