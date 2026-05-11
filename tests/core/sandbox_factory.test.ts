import { describe, it, expect, vi } from 'vitest';
import { SandboxFactory } from '../../src/sandbox/index';
import { DockerSandbox } from '../../src/sandbox/docker';
import { LocalSandbox } from '../../src/sandbox/local';
import { RepoBenchConfig } from '../../src/core/config';

vi.mock('../../src/sandbox/docker');
vi.mock('../../src/sandbox/local');

describe('SandboxFactory', () => {
  const mockConfig: RepoBenchConfig = {
    mining: { keywords: [], exclude_paths: [], source_extensions: [] },
    llm: { model: 'gpt-4o-mini', temperature: 0 },
    sandbox: {
      build_command: 'npm install',
      test_command: 'npm test',
      env_vars: { NODE_ENV: 'test' },
    },
  };

  const options = {
    repoPath: '/tmp/repo',
    image: 'node:20',
    commitHash: 'abc1234',
  };

  it('should map config settings to SandboxOptions when creating a Docker sandbox', () => {
    SandboxFactory.create(options, mockConfig, true);

    expect(DockerSandbox).toHaveBeenCalledWith({
      ...options,
      buildCommand: mockConfig.sandbox.build_command,
      testCommand: mockConfig.sandbox.test_command,
      envVars: mockConfig.sandbox.env_vars,
    });
  });

  it('should map config settings to SandboxOptions when creating a Local sandbox', () => {
    SandboxFactory.create(options, mockConfig, false);

    expect(LocalSandbox).toHaveBeenCalledWith({
      ...options,
      buildCommand: mockConfig.sandbox.build_command,
      testCommand: mockConfig.sandbox.test_command,
      envVars: mockConfig.sandbox.env_vars,
    });
  });
});
