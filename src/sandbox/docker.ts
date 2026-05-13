import { ISandbox } from '../types/contracts';
import { SandboxOptions } from '../types/contracts';
import Docker from 'dockerode';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import crypto from 'crypto';
import { spawn } from 'child_process';

export class DockerSandbox implements ISandbox {
  private docker: Docker;
  private container: any;
  private options: SandboxOptions;
  private hostTempDir?: string;

  constructor(options: SandboxOptions) {
    this.docker = new Docker();
    this.options = options;
  }

  async init() {
    try {
      await this.ensureBaseImage();
      const layeredImage = await this.getLayeredImage();
      this.hostTempDir = path.join(os.tmpdir(), `repobench-docker-${crypto.randomUUID()}`);
      await fs.mkdir(this.hostTempDir, { recursive: true });

      const binds = [`${this.hostTempDir}:/app`];
      if (this.options.cachePaths) {
        for (const [hostPath, containerPath] of Object.entries(this.options.cachePaths)) {
          const absoluteHostPath = path.resolve(process.cwd(), hostPath);
          await fs.mkdir(absoluteHostPath, { recursive: true });
          binds.push(`${absoluteHostPath}:${containerPath}:rw`);
        }
      }

       this.container = await this.docker.createContainer({
          Image: layeredImage,
          Cmd: ['/bin/bash'],
          Tty: true,
          WorkingDir: '/app',
          HostConfig: { Binds: binds },
          Env: Object.entries(this.options.envVars || {}).map(([k, v]) => `${k}=${v}`),
        });
        await this.container.start();

       
       await this.runDirect(['git', 'clone', this.options.repoPath, '.']);
      await this.runDirect(['git', 'checkout', this.options.commitHash]);
    } catch (e: any) {
      throw new Error(`DockerSandbox init failed: ${e.message}`);
    }
  }

  private async getLayeredImage(): Promise<string> {
    const { preBuildHashFile, preBuildCommands, baseImage, image } = this.options;
    const currentBase = baseImage || image;

    if (!preBuildHashFile || !preBuildCommands || preBuildCommands.length === 0) {
      return currentBase;
    }

    const absoluteHashPath = path.resolve(process.cwd(), preBuildHashFile);
    const content = await fs.readFile(absoluteHashPath);
    const hash = crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
    const layerTag = `repobench-layer-${hash}`;

    try {
      await this.docker.getImage(layerTag);
      return layerTag;
    } catch (e) {
      const tempDockerfileDir = path.join(os.tmpdir(), `repobench-dockerfile-${crypto.randomUUID()}`);
      try {
        await fs.mkdir(tempDockerfileDir, { recursive: true });
        
        const dockerfileContent = [
          `FROM ${currentBase}`,
          ...preBuildCommands.map(cmd => `RUN ${cmd}`),
        ].join('\n');

        const dockerfilePath = path.join(tempDockerfileDir, 'Dockerfile');
        await fs.writeFile(dockerfilePath, dockerfileContent);

        await new Promise<void>((resolve, reject) => {
          const child = spawn('docker', ['build', '-t', layerTag, tempDockerfileDir]);
          child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Layered build failed with exit code ${code}`));
          });
          child.on('error', reject);
        });
        return layerTag;
      } finally {
        await fs.rm(tempDockerfileDir, { recursive: true, force: true });
      }
    }
  }

  private async ensureBaseImage() {
    const { baseImage, baseImagePath } = this.options;
    if (!baseImage) return;

    try {
      await this.docker.getImage(baseImage);
    } catch (e) {
      if (baseImagePath) {
        const absolutePath = path.resolve(process.cwd(), baseImagePath);
        const context = path.dirname(absolutePath);
        const dockerfile = path.basename(absolutePath);
        
        await new Promise<void>((resolve, reject) => {
          const child = spawn('docker', ['build', '-t', baseImage, '-f', absolutePath, context]);
          child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`docker build failed with exit code ${code}`));
          });
          child.on('error', reject);
        });
      }
    }
  }

  private async runDirect(args: string[]): Promise<string> {
    const exec = await this.container.exec({
      Cmd: args,
      AttachStdout: true,
      AttachStderr: true,
    });
    const stream = await exec.start();
    const output = await new Promise<string>((resolve, reject) => {
      let data = '';
      stream.on('data', (chunk: any) => { data += chunk.toString(); });
      stream.on('end', () => resolve(data.trim()));
      stream.on('error', reject);
    });

    const inspect = await exec.inspect();
    if (inspect.ExitCode !== 0) {
      throw new Error(`Command ${args.join(' ')} failed with exit code ${inspect.ExitCode}. Output: ${output}`);
    }
    return output;
  }

  async execute(cmd: string, timeout?: number): Promise<string> {
    const exec = await this.container.exec({
      Cmd: ['bash', '-c', cmd],
      AttachStdout: true,
      AttachStderr: true,
    });
    const stream = await exec.start();
    
    return new Promise<string>((resolve, reject) => {
      let data = '';
      const timer = timeout ? setTimeout(async () => {
        try {
          await exec.stop();
        } catch (e) {}
        reject(new Error('TimeoutError: Command exceeded timeout'));
      }, timeout) : null;

      stream.on('data', (chunk: any) => { data += chunk.toString(); });
      stream.on('end', async () => {
        if (timer) clearTimeout(timer);
        const inspect = await exec.inspect();
        if (inspect.ExitCode !== 0) {
          reject(new Error(`Command failed (ExitCode ${inspect.ExitCode}): ${data}`));
        } else {
          resolve(data.trim());
        }
      });
      stream.on('error', (err: any) => {
        if (timer) clearTimeout(timer);
        reject(err);
      });
    });
  }

  async setup(): Promise<void> {
    if (this.options.buildCommand) {
      await this.execute(this.options.buildCommand);
    }
  }

  async verify(): Promise<boolean> {
    if (this.options.testCommand) {
      try {
        await this.execute(this.options.testCommand);
        return true;
      } catch (e) {
        return false;
      }
    }
    return true;
  }

  async switchToState(commitHash: string): Promise<void> {
    try {
      await this.runDirect(['git', 'checkout', commitHash]);
    } catch (e: any) {
      throw new Error(`DockerSandbox switchToState failed: ${e.message}`);
    }
  }

  async destroy() {
    if (this.container) {
      try {
        await this.container.stop().catch(() => {});
        await this.container.remove().catch(() => {});
      } catch (e) {
        console.error(`Failed to remove Docker container:`, e);
      }
      this.container = null;
    }
    if (this.hostTempDir) {
      try {
        await fs.rm(this.hostTempDir, { recursive: true, force: true });
      } catch (e) {
        console.error(`Failed to remove Docker host temp dir:`, e);
      }
      this.hostTempDir = undefined;
    }
    await this.pruneCachedImages();
  }

  private async pruneCachedImages() {
    try {
      const images = await this.docker.listImages();
      const prefix = 'repobench-layer-';
      
      const cachedImages = images
        .filter(img => img.RepoTags && img.RepoTags.some(tag => tag.startsWith(prefix)))
        .map(img => ({
          id: img.Id,
          created: img.Created,
          tags: img.RepoTags
        }))
        .sort((a, b) => b.created - a.created);

      const maxLayers = this.options.maxCachedLayers ?? 10;
      if (cachedImages.length <= maxLayers) return;

      const toDelete = cachedImages.slice(maxLayers);
      for (const img of toDelete) {
        try {
          const image = this.docker.getImage(img.id);
          await image.remove({ force: false });
        } catch (e) {
          // Ignore errors if image is in use
        }
      }
    } catch (e: any) {
      console.error(`Failed to prune cached images: ${e.message}`);
    }
  }

  getWorkingDir(): string {
    return this.hostTempDir || '';
  }

  async ping(): Promise<boolean> {
    if (!this.container) return false;
    try {
      const data = await this.container.inspect();
      return data.State.Running === true;
    } catch {
      return false;
    }
  }
}
