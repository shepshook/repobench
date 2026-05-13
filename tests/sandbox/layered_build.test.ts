import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DockerSandbox } from '../../src/sandbox/docker';
import { SandboxOptions } from '../../src/types/contracts';
import { spawn } from 'child_process';
import Docker from 'dockerode';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

vi.mock('child_process', async () => {
  const actual = await vi.importActual('child_process');
  return {
    ...actual,
    spawn: vi.fn(),
  };
});

vi.mock('dockerode');

describe('DockerSandbox Layered Build', () => {
  const mockOptions: SandboxOptions = {
    repoPath: 'https://github.com/test/repo',
    image: 'ubuntu:latest',
    commitHash: 'main',
    envVars: {},
    baseImage: 'ubuntu:latest',
    preBuildCommands: ['npm install'],
    preBuildHashFile: 'package-lock.json',
  };

  const mockContainer = {
    start: vi.fn().mockResolvedValue({}),
    exec: vi.fn().mockResolvedValue({
      start: vi.fn().mockResolvedValue({
        on: vi.fn().mockImplementation(function(event, cb) {
          if (event === 'data') cb('mock output');
          if (event === 'end') cb();
          return this;
        }),
      }),
      inspect: vi.fn().mockResolvedValue({ ExitCode: 0 }),
    }),
    stop: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue({}),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Docker).mockImplementation(function() {
      return {
        createContainer: vi.fn().mockResolvedValue(mockContainer),
        getImage: vi.fn(),
      };
    });
  });

  const createMockProcess = (exitCode: number) => ({
    on: vi.fn().mockImplementation(function(event, cb) {
      if (event === 'close') cb(exitCode);
      return this;
    }),
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
  });

  it('should build the layered image on the first run', async () => {
    const hashFile = path.join(os.tmpdir(), 'package-lock.json');
    await fs.writeFile(hashFile, 'lock-content-1');
    
    const options = { ...mockOptions, preBuildHashFile: hashFile };
    const sandbox = new DockerSandbox(options);

    const dockerInstance = vi.mocked(Docker).mock.results[0].value as any;
    dockerInstance.getImage.mockImplementation(async (image: string) => {
      if (image.startsWith('repobench-layer-')) {
        throw new Error('Image not found');
      }
      return {};
    });

    (spawn as any).mockImplementation(() => createMockProcess(0));

    await sandbox.init();

    expect(spawn).toHaveBeenCalledWith(
      'docker',
      expect.arrayContaining(['build', '-t', expect.stringContaining('repobench-layer-')])
    );
    await sandbox.destroy();
  });

  it('should skip building the layered image if it already exists', async () => {
    const hashFile = path.join(os.tmpdir(), 'package-lock.json');
    await fs.writeFile(hashFile, 'lock-content-1');
    
    const options = { ...mockOptions, preBuildHashFile: hashFile };
    const sandbox = new DockerSandbox(options);

    const dockerInstance = vi.mocked(Docker).mock.results[0].value as any;
    dockerInstance.getImage.mockImplementation(async (image: string) => {
      return {};
    });

    (spawn as any).mockImplementation(() => createMockProcess(0));

    await sandbox.init();

    expect(spawn).not.toHaveBeenCalledWith(
      'docker',
      expect.arrayContaining(['build', '-t', expect.stringContaining('repobench-layer-')])
    );
    await sandbox.destroy();
  });

  it('should rebuild the layered image when the hash file changes', async () => {
    const hashFile = path.join(os.tmpdir(), 'package-lock.json');
    
    // First run
    await fs.writeFile(hashFile, 'lock-content-1');
    const options1 = { ...mockOptions, preBuildHashFile: hashFile };
    const sandbox1 = new DockerSandbox(options1);

    const dockerInstance1 = vi.mocked(Docker).mock.results[0].value as any;
    dockerInstance1.getImage.mockImplementation(async (image: string) => {
      if (image.includes('lock-content-1')) return {}; // simulate cached for 1st hash
      throw new Error('Image not found');
    });

    (spawn as any).mockImplementation(() => createMockProcess(0));
    await sandbox1.init();
    await sandbox1.destroy();

    // Second run with different content
    await fs.writeFile(hashFile, 'lock-content-2');
    const options2 = { ...mockOptions, preBuildHashFile: hashFile };
    const sandbox2 = new DockerSandbox(options2);

    const dockerInstance2 = vi.mocked(Docker).mock.results[1].value as any;
    dockerInstance2.getImage.mockImplementation(async (image: string) => {
      if (image.includes('lock-content-1')) return {}; 
      throw new Error('Image not found'); // hash 2 not found
    });

    await sandbox2.init();

    expect(spawn).toHaveBeenCalledWith(
      'docker',
      expect.arrayContaining(['build', '-t', expect.stringContaining('repobench-layer-')])
    );
    await sandbox2.destroy();
  });
});
