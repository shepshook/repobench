import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SandboxFactory } from '../../src/sandbox/index';

describe('Sandbox', () => {
  let sandbox: any;
  const testRepo = 'D:/dev/RepoBench/toy-repo';

  beforeEach(() => {
    // Use LocalSandbox for tests since Docker is unavailable in this environment
    sandbox = SandboxFactory.create({
      repoPath: testRepo,
      image: 'node:20-slim',
      commitHash: 'master',
    }, { 
      sandbox: { build_command: '', test_command: '', env_vars: {} },
      mining: { keywords: [], exclude_paths: [], source_extensions: [] },
      llm: { model: 'gpt-4o-mini', temperature: 0 }
    } as any, false);
  });

  afterEach(async () => {
    await sandbox.destroy();
  });

  it('should successfully initialize and checkout the repo', async () => {
    await sandbox.init();
    
    const checkRepo = await sandbox.execute(process.platform === 'win32' ? 'dir' : 'ls');
    expect(checkRepo).toContain('index.js');
    
    const checkGit = await sandbox.execute('git rev-parse HEAD');
    expect(checkGit).toBeDefined();
  });
});
