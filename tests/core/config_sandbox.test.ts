import { describe, it, expect, beforeAll } from 'vitest';
import { Config } from '../../src/core/config';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Config Sandbox', () => {
  const tmpDir = path.join(os.tmpdir(), 'repobench-config-sandbox-tests');
  
  beforeAll(() => {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  });

  it('should load build_command and test_command from yaml', () => {
    const configPath = path.join(tmpDir, 'sandbox_valid.yaml');
    const content = `
sandbox:
  build_command: "make build"
  test_command: "make test"
`;
    fs.writeFileSync(configPath, content);
    
    const config = Config.load(configPath);
    expect(config.sandbox.build_command).toBe('make build');
    expect(config.sandbox.test_command).toBe('make test');
  });

  it('should use defaults for build_command and test_command when missing', () => {
    const configPath = path.join(tmpDir, 'sandbox_missing.yaml');
    const content = `
sandbox:
  env_vars:
    NODE_ENV: "test"
`;
    fs.writeFileSync(configPath, content);
    
    const config = Config.load(configPath);
    // Expecting empty strings as defaults
    expect(config.sandbox.build_command).toBe('');
    expect(config.sandbox.test_command).toBe('');
  });

  it('should use defaults for sandbox config when completely missing', () => {
    const configPath = path.join(tmpDir, 'no_sandbox.yaml');
    const content = `
mining:
  keywords: ['test']
`;
    fs.writeFileSync(configPath, content);
    
    const config = Config.load(configPath);
    expect(config.sandbox.build_command).toBe('');
    expect(config.sandbox.test_command).toBe('');
  });
});
