import { SandboxConfig } from '../../src/core/contracts';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { VolumeManager } from '../../src/infrastructure/volume-manager';
import { MockDocker } from '../mocks/docker.mock';
import { vi } from 'vitest';

export interface SandboxFixture {
  sandbox: Sandbox;
  volumeManager: VolumeManager;
  mockDocker: MockDocker;
  config: SandboxConfig;
}

export function createSandboxFixture(overrides: Partial<SandboxConfig> = {}) {
  const config: SandboxConfig = {
    project: 'test-project',
    baseImage: 'node:20-alpine',
    cachePaths: ['/app/node_modules'],
    envVars: {},
    ...overrides,
  };

  const mockDocker = new MockDocker();
  mockDocker.setupGetImageSuccess();
  mockDocker.setupCreateContainerSuccess();
  
  const volumeManager = new VolumeManager(mockDocker);
  const sandbox = new Sandbox(config, volumeManager);

  return {
    sandbox,
    volumeManager,
    mockDocker,
    config,
  };
}

export function createSimulationFixture(overrides: Partial<SandboxConfig> = {}) {
  const fixture = createSandboxFixture(overrides);
  
  // Force simulation mode by making createContainer fail
  vi.spyOn(fixture.mockDocker, 'createContainer').mockRejectedValue({
    code: 'ENOENT',
    message: 'connect ENOENT //./pipe/docker_engine'
  });

  return fixture;
}

export function createFailingDockerFixture(errorType: 'volume' | 'image' | 'container', overrides: Partial<SandboxConfig> = {}) {
  const fixture = createSandboxFixture(overrides);
  
  if (errorType === 'volume') {
    vi.spyOn(fixture.mockDocker, 'createVolume').mockRejectedValue({
      code: 'ENOENT',
      message: 'connect ENOENT //./pipe/docker_engine'
    });
  } else if (errorType === 'image') {
    vi.spyOn(fixture.mockDocker, 'getImage').mockRejectedValue(new Error('docker_engine ENOENT'));
    vi.spyOn(fixture.mockDocker, 'pull').mockRejectedValue(new Error('docker_engine ENOENT'));
  } else if (errorType === 'container') {
    vi.spyOn(fixture.mockDocker, 'createContainer').mockRejectedValue({
      code: 'ENOENT',
      message: 'connect ENOENT //./pipe/docker_engine'
    });
  }

  return fixture;
}

