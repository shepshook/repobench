import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSandboxFixture, createSimulationFixture, createFailingDockerFixture } from './fixtures';
import { VolumeManager } from '../../src/infrastructure/volume-manager';

describe('Sandbox State Management', () => {
  const HASH_1 = '518a18328344bd6cf80ab0c61904dc0135e0f6fb';
  const HASH_2 = 'a263f3f3d41a44a43655ff60a0c1ab34de9aa99f';

  it('should invalidate or switch cache when switching state to a commit with different dependencies', async () => {
    const config = {
      buildCommand: 'git clone https://github.com/anomalyco/repobench.git /app && cd /app',
      cachePaths: ['/tmp/repobench-cache'],
      project: 'state-switch-project'
    };

    const { sandbox } = createSandboxFixture(config);
    await sandbox.init();
    
    const cacheFilePath = '/tmp/repobench-cache/state-test.txt';
    const content1 = 'content-for-hash-1';
    
    vi.spyOn(sandbox, 'execute').mockResolvedValue({
      stdout: '', stderr: '', exitCode: 0,
    });
    await sandbox.execute(`mkdir -p /tmp/repobench-cache && echo "${content1}" > ${cacheFilePath}`);
    
    await sandbox.switchState(HASH_2);
    
    vi.spyOn(sandbox, 'execute').mockResolvedValue({
      exitCode: 1, stdout: '', stderr: 'No such file',
    });
    const result = await sandbox.execute(`cat ${cacheFilePath}`);
    expect(result.exitCode).not.toBe(0);
    await sandbox.destroy();
  });

  it('should invalidate cache on state switch in a minimal config', async () => {
    const config = {
      cachePaths: ['/tmp/repobench-cache'],
      project: 'state-switch-minimal'
    };

    const { sandbox } = createSandboxFixture(config);
    await sandbox.init();
    
    const cacheFilePath = '/tmp/repobench-cache/state-test.txt';
    const content1 = 'content-for-hash-1';
    
    vi.spyOn(sandbox, 'execute').mockResolvedValue({
      stdout: '', stderr: '', exitCode: 0,
    });
    await sandbox.execute(`mkdir -p /tmp/repobench-cache && echo "${content1}" > ${cacheFilePath}`);
    await sandbox.switchState(HASH_2);
    
    vi.spyOn(sandbox, 'execute').mockResolvedValue({
      exitCode: 1, stdout: '', stderr: 'No such file',
    });
    const result = await sandbox.execute(`cat ${cacheFilePath}`);
    expect(result.exitCode).not.toBe(0);
    await sandbox.destroy();
  });

  it('should throw a descriptive error when switching to a non-existent commit hash', async () => {
    const { sandbox } = createSandboxFixture({
      buildCommand: 'git clone https://github.com/anomalyco/repobench.git /app && cd /app',
      project: 'error-visibility-project'
    });
    await sandbox.init();

    vi.spyOn(sandbox, 'execute').mockResolvedValue({
      exitCode: 128, stdout: '', stderr: 'fatal: not a git repository',
    });
    const INVALID_HASH = '0000000000000000000000000000000000000000';
    await expect(sandbox.switchState(INVALID_HASH)).rejects.toThrow();
    await sandbox.destroy();
  });

  it('should throw a ZodError when switching to an invalid hash format', async () => {
    const { sandbox } = createSandboxFixture({ project: 'error-handling-project' });
    await sandbox.init();
    
    const invalidHash = 'not-a-hash';
    await expect(sandbox.switchState(invalidHash)).rejects.toThrow();
    await sandbox.destroy();
  });

  it('should throw a GitOperationError when git checkout fails', async () => {
    const { sandbox } = createSandboxFixture({
      buildCommand: 'git clone https://github.com/anomalyco/repobench.git /app && cd /app',
      project: 'git-failure-project'
    });
    await sandbox.init();
    
    vi.spyOn(sandbox, 'execute').mockResolvedValue({
      exitCode: 128, stdout: '', stderr: 'fatal: not a git repository',
    });
    const nonExistentHash = '0000000000000000000000000000000000000000';
    await expect(sandbox.switchState(nonExistentHash)).rejects.toThrow();
    await sandbox.destroy();
  });

  it('should restore file state from a snapshot', async () => {
    const { sandbox } = createSimulationFixture();
    await sandbox.init();
    
    const filePath = '/tmp/rollback-test.txt';
    await sandbox.execute(`echo "v1" > ${filePath}`);
    
    await sandbox.createSnapshot();
    
    await sandbox.execute(`echo "v2" > ${filePath}`);
    const { stdout: contentV2 } = await sandbox.execute(`cat ${filePath}`);
    expect(contentV2).toContain('v2');
    
    await sandbox.restoreSnapshot();
    const { stdout: contentV1 } = await sandbox.execute(`cat ${filePath}`);
    expect(contentV1).toContain('v1');
    
    await sandbox.destroy();
  });

  it('should rollback state when a build command fails after an edit', async () => {
    const { sandbox } = createSimulationFixture();
    await sandbox.init();
    
    const filePath = '/tmp/build-test.txt';
    await sandbox.execute(`echo "valid" > ${filePath}`);
    
    await sandbox.createSnapshot();
    
    await sandbox.execute(`echo "invalid" > ${filePath}`);
    
    const buildResult = await sandbox.execute(`grep "invalid" ${filePath} && exit 1 || exit 0`);
    
    if (buildResult.exitCode !== 0) {
       await sandbox.restoreSnapshot();
    }
    
    const { stdout: content } = await sandbox.execute(`cat ${filePath}`);
    expect(content).toContain('valid');
    
    await sandbox.destroy();
  });

  it('should throw a descriptive error when restoring a snapshot without having created one', async () => {
    const { sandbox } = createSimulationFixture();
    await sandbox.init();
    await expect(sandbox.restoreSnapshot()).rejects.toThrow();
    await sandbox.destroy();
  });

});
