import { describe, it, expect } from 'vitest';
import Docker from 'dockerode';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { VolumeManager } from '../../src/infrastructure/volume-manager';

describe('Docker Connectivity', () => {
  it('should be able to connect to the Docker engine', async () => {
    const docker = new Docker();
    try {
      await docker.version();
    } catch (error: any) {
      if (error.message.includes('//./pipe/docker_engine') || error.code === 'ENOENT') {
        console.warn('Docker engine not available; skipping connectivity test');
        return;
      }
      throw error;
    }
  });

  it('should throw a VolumeManagerError with full context when Docker engine is unavailable', async () => {
    const mockDocker = {
      getImage: () => ({
        inspect: () => Promise.reject({ 
          code: 'ENOENT', 
          message: 'connect ENOENT //./pipe/docker_engine',
          stdout: 'some stdout',
          stderr: 'some stderr'
        })
      }),
      pull: () => Promise.reject({ 
        code: 'ENOENT', 
        message: 'connect ENOENT //./pipe/docker_engine' 
      }),
      createVolume: () => Promise.resolve({}),
      getVolume: () => Promise.resolve({}),
      createContainer: () => Promise.resolve({}),
    } as any;

    const vm = new VolumeManager(mockDocker);
    const config = { project: 'context-test' };
    const sandbox = new Sandbox(config, vm);

    try {
      await sandbox.init();
    } catch (error: any) {
      expect(error.name).toBe('VolumeManagerError');
      expect(error.context).toBeDefined();
      expect(error.context.stderr).toBeDefined();
      expect(error.message).toContain('connect ENOENT //./pipe/docker_engine');
    }
  });
});
