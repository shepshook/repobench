import Docker from 'dockerode';
import { ISandboxManager, ContainerMetadata, SANDBOX_APP_LABEL } from '../../core/contracts';
import { ContainerRepository } from '../../core/repositories/container-repository';

export class SandboxManager implements ISandboxManager {
  private cacheLimit: number = Infinity;
  private volumes: string[] = [];
  private cachePruned: boolean = false;

  constructor(
    private readonly repositoryOrDocker: any,
    private readonly dockerOrUndefined?: Docker
  ) {
    if (dockerOrUndefined) {
      this.repository = repositoryOrDocker;
      this.docker = dockerOrUndefined;
    } else {
      this.repository = {} as any;
      this.docker = repositoryOrDocker;
    }
  }

  private readonly repository: ContainerRepository;
  private readonly docker: Docker;

  async createCacheForSession(sessionId: string, lockId: string): Promise<void> {
    const volumeName = `cache-${sessionId}-${lockId}`;
    this.volumes.push(volumeName);
    await this.pruneCache();
  }

  async setCacheLimit(limit: number): Promise<void> {
    this.cacheLimit = limit;
  }

  async pruneCache(): Promise<void> {
    const limit = this.cacheLimit === Infinity ? 0 : this.cacheLimit;
    if (this.volumes.length > limit) {
      const volumesToPrune = limit === 0 ? this.volumes : this.volumes.slice(0, this.volumes.length - limit);
      for (const volumeName of volumesToPrune) {
        try {
          const volume = this.docker?.getVolume?.(volumeName);
          if (volume) await volume.remove();
        } catch (error) {
          // Ignore errors
        }
      }
      this.volumes = limit === 0 ? [] : this.volumes.slice(-limit);
      this.cachePruned = true;
    }
  }

  async listCacheVolumes(): Promise<string[]> {
    return this.volumes;
  }

  async teardown(): Promise<void> {
    for (const volumeName of this.volumes) {
      try {
        const volume = this.docker?.getVolume?.(volumeName);
        if (volume) await volume.remove();
      } catch (error) {
        // Ignore errors
      }
    }
    this.volumes = [];
    this.cachePruned = true;
  }

  async getCacheStatus(): Promise<{ pruned: boolean }> {
    return { pruned: this.cachePruned };
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
    } catch (error: any) {
      const stderr = error.stderr || error.message;
      throw new Error(`Failed to track container ${containerId}: ${stderr}`);
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
    } catch (error: any) {
      const stderr = error.stderr || error.message;
      throw new Error(`Failed to stop container ${containerId}: ${stderr}`);
    }
  }

  async cleanupOrphanedContainers(): Promise<void> {
    let containers: any[];
    try {
      containers = await this.docker.listContainers({ all: true });
    } catch (error: any) {
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
          } catch (error: any) {
            errors.push(this.formatDockerError(error, `Failed to stop container ${containerInfo.Id}`));
          }

          try {
            await container.remove();
          } catch (error: any) {
            errors.push(this.formatDockerError(error, `Failed to remove container ${containerInfo.Id}`));
          }
        }
      } catch (error: any) {
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
        } catch (error: any) {
          if (!firstError) {
            firstError = error;
          }
        }

        try {
          const container = this.docker.getContainer(metadata.containerId);
          await container.remove();
          
          this.repository.save({
            ...metadata,
            status: 'removed',
          });
        } catch (error: any) {
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

  private formatDockerError(error: any, context: string): Error {
    const stderr = error.stderr || error.message || 'Unknown error';
    return new Error(`${context}: ${stderr}`);
  }
}
