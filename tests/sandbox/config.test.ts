import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Config } from '../../src/core/config';
import { SandboxFactory } from '../../src/sandbox/index';

describe('Sandbox Configuration Validation', () => {
  let tmpDir: string;
  let configPath: string;
  const repoPath = process.cwd();
  const commitHash = 'HEAD';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repobench-config-test-'));
    configPath = path.join(tmpDir, 'repobench.yaml');
    // Change cwd to tmpDir so Config.load() can find repobench.yaml if we use relative path
    // But Config.load() uses process.cwd(), so we must be careful.
    // We will pass the absolute path to Config.load().
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const writeConfig = (config: any) => {
    const yaml = require('yaml');
    fs.writeFileSync(configPath, yaml.stringify(config));
  };

  it('should execute build_command during setup and return true for valid test_command', async () => {
    const buildCmd = process.platform === 'win32' ? 'echo setup_done > setup_done.txt' : 'touch setup_done.txt';
    const testCmd = process.platform === 'win32' ? 'if exist setup_done.txt (exit 0) else (exit 1)' : 'test -f setup_done.txt';

    writeConfig({
      sandbox: {
        build_command: buildCmd,
        test_command: testCmd,
      },
    });

    const config = Config.load(configPath);
    const sandbox = SandboxFactory.create({
      repoPath,
      image: 'test-image',
      commitHash,
    }, config, false);

    try {
      await sandbox.init();
      await sandbox.setup();
      
      // Verify build_command executed by checking for the file
      // Note: sandbox.execute is available
      const checkFile = await sandbox.execute(process.platform === 'win32' ? 'dir setup_done.txt' : 'ls setup_done.txt');
      expect(checkFile).toBeDefined();

      const result = await sandbox.verify();
      expect(result).toBe(true);
    } finally {
      await sandbox.destroy();
    }
  });

  it('should throw error when build_command fails', async () => {
    const buildCmd = process.platform === 'win32' ? 'exit 1' : 'false';
    
    writeConfig({
      sandbox: {
        build_command: buildCmd,
      },
    });

    const config = Config.load(configPath);
    const sandbox = SandboxFactory.create({
      repoPath,
      image: 'test-image',
      commitHash,
    }, config, false);

    try {
      await sandbox.init();
      await expect(sandbox.setup()).rejects.toThrow();
    } finally {
      await sandbox.destroy();
    }
  });

  it('should return false when test_command fails', async () => {
    const testCmd = process.platform === 'win32' ? 'exit 1' : 'false';
    
    writeConfig({
      sandbox: {
        test_command: testCmd,
      },
    });

    const config = Config.load(configPath);
    const sandbox = SandboxFactory.create({
      repoPath,
      image: 'test-image',
      commitHash,
    }, config, false);

    try {
      await sandbox.init();
      const result = await sandbox.verify();
      expect(result).toBe(false);
    } finally {
      await sandbox.destroy();
    }
  });
});
