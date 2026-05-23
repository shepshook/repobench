import Docker from 'dockerode';
import { ISandboxManager, ContainerMetadata, SANDBOX_APP_LABEL } from '../../core/contracts';
import { ContainerRepository } from '../../core/repositories/container-repository';

interface DockerError {
  message?: string;
  stderr?: string;
  stack?: string;
}

export class SandboxManager implements ISandboxManager {
  private cacheLimit: number = Infinity;
  private volumes: string[] = [];
  private cachePruned: boolean = false;

  constructor(
    repositoryOrDocker: ContainerRepository | Docker,
    dockerOrUndefined?: Docker,
  ) {
    if (dockerOrUndefined) {
      this.repository = repositoryOrDocker as ContainerRepository;
      this.docker = dockerOrUndefined;
    } else {
      this.repository = {} as ContainerRepository;
      this.docker = repositoryOrDocker as Docker;
    }
  }

  private readonly repository: ContainerRepository;
  private readonly docker: Docker;

  async createCacheForSession(sessionId: string, lockId: string): Promise<void> {
    const volumeName = `cache-${sessionId}-${lockId}`;
    this.volumes.push(volumeName);
    if (this.cacheLimit !== Infinity) {
      await this.pruneCache();
    }
  }

  setCacheLimit(limit: number): Promise<void> {
    this.cacheLimit = limit;
    return Promise.resolve();
  }

  async pruneCache(): Promise<void> {
    const limit = this.cacheLimit === Infinity ? 0 : this.cacheLimit;
    if (this.volumes.length > limit) {
      const volumesToPrune = limit === 0 ? this.volumes : this.volumes.slice(0, this.volumes.length - limit);
      for (const volumeName of volumesToPrune) {
        try {
          const volume = this.docker.getVolume(volumeName);
          await volume.remove();
        } catch (err: unknown) {
          console.warn(`pruneCache: failed to remove volume: ${(err as Error).message}`);
        }
      }
      this.volumes = limit === 0 ? [] : this.volumes.slice(-limit);
      this.cachePruned = true;
    }
  }

  listCacheVolumes(): Promise<string[]> {
    return Promise.resolve(this.volumes);
  }

  async teardown(): Promise<void> {
    for (const volumeName of this.volumes) {
      try {
        const volume = this.docker.getVolume(volumeName);
        await volume.remove();
        } catch (err: unknown) {
          console.warn(`teardown: failed to remove volume: ${(err as Error).message}`);
        }
      }
      this.volumes = [];
    this.cachePruned = true;
  }

  getCacheStatus(): Promise<{ pruned: boolean }> {
    return Promise.resolve({ pruned: this.cachePruned });
  }

  async trackContainer(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      const data = await container.inspect();

      const metadata: ContainerMetadata = {
        containerId,
        image: data.Config.Image,
        createdAt: new Date(data.Created).toISOString(),
        status: data.State.Status,
        labels: {
          app: SANDBOX_APP_LABEL,
        },
      };

      this.repository.save(metadata);
    } catch (error: unknown) {
      const dockerError = error as DockerError;
      const stderr = dockerError.stderr || dockerError.message;
      throw new Error(`Failed to track container ${containerId}: ${stderr ?? 'Unknown error'}`, { cause: error });
    }
  }

  async stopContainer(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.stop();

      const metadata = this.repository.getById(containerId);
      if (metadata) {
        this.repository.save({
          ...metadata,
          status: 'stopped',
        });
      }
    } catch (error: unknown) {
      const dockerError = error as DockerError;
      const stderr = dockerError.stderr || dockerError.message;
      throw new Error(`Failed to stop container ${containerId}: ${stderr ?? 'Unknown error'}`, { cause: error });
    }
  }

  async cleanupOrphanedContainers(): Promise<void> {
    let containers: Docker.ContainerInfo[];
    try {
      containers = await this.docker.listContainers({ all: true });
    } catch (error: unknown) {
      throw this.formatDockerError(error, 'Failed to cleanup orphaned containers');
    }

    const errors: Error[] = [];

    for (const containerInfo of containers) {
      try {
        const container = this.docker.getContainer(containerInfo.Id);
        const data = await container.inspect();

        if (data.Config.Labels?.app === SANDBOX_APP_LABEL) {
          try {
            await container.stop();
           } catch (error: unknown) {
             errors.push(this.formatDockerError(error, `Failed to stop container ${containerInfo.Id}`));
           }


          try {
            await container.remove();
           } catch (error: unknown) {
             errors.push(this.formatDockerError(error, `Failed to remove container ${containerInfo.Id}`));
           }

        }
       } catch (error: unknown) {
         errors.push(this.formatDockerError(error, `Failed to inspect container ${containerInfo.Id}`));
       }

    }

    if (errors.length > 0) {
      throw new Error(`Failed to cleanup some orphaned containers:\n${errors.map(e => e.message).join('\n')}`);
    }
  }

  async killTimedOutContainers(timeoutMs: number): Promise<void> {
    const containers = this.repository.getAll();
    const now = new Date();
    let firstError: Error | null = null;

    for (const metadata of containers) {
      const createdAt = new Date(metadata.createdAt);
      const ageMs = now.getTime() - createdAt.getTime();

      if (ageMs > timeoutMs) {
        try {
          await this.stopContainer(metadata.containerId);
         } catch (error: unknown) {
           if (!firstError) {
             firstError = error as Error;
           }
         }


        try {
          const container = this.docker.getContainer(metadata.containerId);
          await container.remove();
          
          this.repository.save({
            ...metadata,
            status: 'removed',
          });
         } catch (error: unknown) {
           if (!firstError) {
             firstError = this.formatDockerError(error, `Failed to remove timed-out container ${metadata.containerId}`);
           }
         }

      }
    }

    if (firstError) {
      throw firstError;
    }
  }

  private formatDockerError(error: unknown, context: string): Error {
    const dockerError = error as DockerError;
    const stderr = dockerError.stderr || dockerError.message || 'Unknown error';
    return new Error(`${context}: ${stderr}`, { cause: error });
  }
}
