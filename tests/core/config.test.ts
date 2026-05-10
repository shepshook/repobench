import { describe, it, expect } from 'vitest';
import { Config } from '../../src/core/config';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Config', () => {
  const tmpDir = path.join(os.tmpdir(), 'repobench-config-tests');
  
  beforeAll(() => {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
  });

  it('should return default config when file is missing', () => {
    const config = Config.load(path.join(tmpDir, 'non-existent.yaml'));
    expect(config.mining.keywords).toEqual(['fix', 'bug', 'issue']);
    expect(config.mining.exclude_paths).toEqual([]);
  });

  it('should load a valid yaml config', () => {
    const configPath = path.join(tmpDir, 'valid.yaml');
    const content = `
mining:
  keywords: ['hotfix', 'patch']
  exclude_paths: ['docs/', 'tests/fixtures/']
sandbox:
  build_command: "npm install"
`;
    fs.writeFileSync(configPath, content);
    
    const config = Config.load(configPath);
    expect(config.mining.keywords).toEqual(['hotfix', 'patch']);
    expect(config.mining.exclude_paths).toEqual(['docs/', 'tests/fixtures/']);
    expect(config.sandbox.build_command).toBe('npm install');
  });

  it('should throw a clear error for invalid yaml schema', () => {
    const configPath = path.join(tmpDir, 'invalid.yaml');
    const content = `
mining:
  keywords: "not an array"
`;
    fs.writeFileSync(configPath, content);
    
    expect(() => Config.load(configPath)).toThrow(/Invalid repobench.yaml configuration/);
  });

  it('should handle malformed yaml files', () => {
    const configPath = path.join(tmpDir, 'malformed.yaml');
    const content = `
mining:
  keywords: [
`;
    fs.writeFileSync(configPath, content);
    
    expect(() => Config.load(configPath)).toThrow(/Failed to read repobench.yaml/);
  });
});
