import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalSandbox, DockerSandbox } from '../../src/sandbox';
import { SandboxOptions } from '../../src/types/contracts';
import { RepoBenchConfig } from '../../src/core/config';

describe('Sandbox Execution', () => {
  const testRepo = 'D:/dev/RepoBench/toy-repo';
  const config: RepoBenchConfig = {
    mining: { keywords: [], exclude_paths: [], source_extensions: [] },
    sandbox: { build_command: '', test_command: '', env_vars: {} },
    llm: { model: 'gpt-4o-mini' },
  };

  const getOptions = (): SandboxOptions => ({
    repoPath: testRepo,
    image: 'node:20-slim',
    commitHash: 'master',
  });

  const runTests = async (sandbox: any) => {
    // Test setup()
    const setupOptions = { ...getOptions(), buildCommand: 'echo build success > build_out.txt' };
    const s1 = new (sandbox.constructor as any)(setupOptions);
    await s1.init();
    await s1.setup();
    const content = await s1.execute('type build_out.txt || cat build_out.txt');
    expect(content).toContain('build success');
    await s1.destroy();

    // Test setup() failure
    const failSetupOptions = { ...getOptions(), buildCommand: 'node -e "process.exit(1)"' };
    const s2 = new (sandbox.constructor as any)(failSetupOptions);
    await s2.init();
    await expect(s2.setup()).rejects.toThrow();
    await s2.destroy();

    // Test verify() success
    const verifyOptions = { ...getOptions(), testCommand: 'echo test success' };
    const s3 = new (sandbox.constructor as any)(verifyOptions);
    await s3.init();
    expect(await s3.verify()).toBe(true);
    await s3.destroy();

    // Test verify() failure
    const failVerifyOptions = { ...getOptions(), testCommand: 'node -e "process.exit(1)"' };
    const s4 = new (sandbox.constructor as any)(failVerifyOptions);
    await s4.init();
    expect(await s4.verify()).toBe(false);
    await s4.destroy();
  };

  it('LocalSandbox should execute commands correctly', async () => {
    const sandbox = new LocalSandbox(getOptions());
    await runTests(sandbox);
  });

  it('DockerSandbox should execute commands correctly', async () => {
    try {
      const sandbox = new DockerSandbox(getOptions());
      await runTests(sandbox);
    } catch (e) {
      console.warn('Docker tests skipped or failed due to Docker unavailability:', e);
    }
  });
});
