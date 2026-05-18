import { IVolumeManager, SANDBOX_APP_LABEL, IDocker } from '../core/contracts';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync } from 'node:fs';

export class VolumeManagerError extends Error {
  constructor(message: string, public context: any) {
    super(message);
    this.name = 'VolumeManagerError';
  }
}

export class VolumeManager implements IVolumeManager {
  private cacheVolumes: Map<string, string> = new Map();
  private activeCreations: Map<string, Promise<boolean>> = new Map();
  private docker: IDocker;



  private hits = 0;
  private misses = 0;
  private missedVolumes: Set<string> = new Set();
  private hitVolumes: Set<string> = new Set();
  private static simulatedCacheVolumes = new Set<string>();
  public readonly simCacheRoot = join(tmpdir(), 'repobench-sim-cache');

  private getStats() {
    return { hits: this.hits, misses: this.misses };
  }
 
  private incrementStats(volumeName: string, hit: boolean) {
    if (hit) {
      if (this.hitVolumes.has(volumeName)) return;
      this.hitVolumes.add(volumeName);
      this.hits++;
    } else {
      if (this.missedVolumes.has(volumeName)) return;
      this.missedVolumes.add(volumeName);
      this.misses++;
    }
  }
 
  constructor(docker: IDocker) {
    if (!docker) {
      throw new Error('Docker instance is required');
    }
    this.docker = docker;

    if (!existsSync(this.simCacheRoot)) {
      try {
        require('node:fs').mkdirSync(this.simCacheRoot, { recursive: true });
      } catch {}
    }
  }

  async getCacheStats(): Promise<{ hits: number; misses: number }> {
    return { hits: this.hits, misses: this.misses };
  }

  async calculateCacheKey(project: string, lockFile?: string): Promise<string> {
    let cacheKey = 'default';
    if (lockFile) {
      try {
        const content = await fs.readFile(lockFile, 'utf8');
        cacheKey = crypto.createHash('sha256').update(content).digest('hex');
      } catch (error) {
        // Fallback to default cache if lock file cannot be read
      }
    }
    return cacheKey;
  }

  async setupCacheVolumes(cacheVolumes: { hostPath: string; containerPath: string }[] | string[], project: string, lockFile?: string, isSimulation = false): Promise<boolean> {
    console.log(`DEBUG: setupCacheVolumes project=${project} isSimulation=${isSimulation}`);
    if (!cacheVolumes || cacheVolumes.length === 0) {
      return true;
    }

    const volumes = typeof cacheVolumes[0] === 'string'
      ? (cacheVolumes as string[]).map(p => ({ hostPath: p, containerPath: p }))
      : (cacheVolumes as { hostPath: string; containerPath: string }[]);

    const cacheKey = await this.calculateCacheKey(project, lockFile);
    const volumeName = `repobench-cache-${project}-${cacheKey}`;
    console.log(`DEBUG: volumeName=${volumeName}`);

    let hit = false;
    try {
        if (isSimulation) {
          console.log(`DEBUG: Checking simulatedCacheVolumes for ${volumeName}. Current size: ${VolumeManager.simulatedCacheVolumes.size}`);
            if (VolumeManager.simulatedCacheVolumes.has(volumeName)) {
              console.log(`DEBUG: Simulation HIT for ${volumeName}`);
              hit = true;
              this.incrementStats(volumeName, true);
            } else {
              console.log(`DEBUG: Simulation MISS for ${volumeName}`);
              hit = false;
              this.incrementStats(volumeName, false);
              VolumeManager.simulatedCacheVolumes.add(volumeName);
            }
        } else {
          console.log(`DEBUG: Calling createVolume for ${volumeName}`);
          hit = await this.createVolume(volumeName);
           if (hit) {
              console.log(`DEBUG: Docker HIT for ${volumeName}`);
              this.incrementStats(volumeName, true);
            } else {
              console.log(`DEBUG: Docker MISS for ${volumeName}`);
              this.incrementStats(volumeName, false);
            }
        }
        // Map containerPath to volumeName
        for (const volume of volumes) {
          await this.mountVolume(volumeName, volume.containerPath);
        }
        return true;
    } catch (error) {
      throw error;
    }
  }

  async recordCacheStatus(project: string, lockFile?: string, isSimulation = false): Promise<{ hit: boolean }> {
    const cacheKey = await this.calculateCacheKey(project, lockFile);
    const volumeName = `repobench-cache-${project}-${cacheKey}`;
    let hit = false;
    if (isSimulation) {
        if (VolumeManager.simulatedCacheVolumes.has(volumeName)) {
          hit = true;
          this.incrementStats(volumeName, true);
        } else {
          hit = false;
          this.incrementStats(volumeName, false);
          VolumeManager.simulatedCacheVolumes.add(volumeName);
        }
    } else {
       try {
         const wasHit = await this.createVolume(volumeName);
         hit = wasHit;
          if (hit) this.incrementStats(volumeName, true); else this.incrementStats(volumeName, false);
       } catch (error) {
         throw error;
       }
    }
    return { hit };
  }

  getVolumes(): Record<string, string> {
    return Object.fromEntries(this.cacheVolumes);
  }

  async createVolume(name: string): Promise<boolean> {
    if (this.activeCreations.has(name)) {
      return this.activeCreations.get(name)!;
    }
    
    const promise = (async () => {
      try {
        await this.docker.createVolume({ Name: name, Labels: { app: SANDBOX_APP_LABEL } });
        return false; // Miss
      } catch (error: any) {
        if (error.json?.message && typeof error.json.message === 'string' && error.json.message.includes('already exists')) {
          return true; // Hit
        }
        
        // Ensure we capture detailed error context for RCA as per Architecture 4.3
        const errorMessage = `Failed to create volume ${name}: ${error.message || 'Unknown error'} (stdout: ${error.stdout || 'N/A'}, stderr: ${error.stderr || 'N/A'})`;
        const errorContext = {
          message: error.message,
          stack: error.stack,
          json: error.json || 'N/A',
          stdout: error.stdout || 'N/A',
          stderr: error.stderr || 'N/A',
        };
        
        throw new VolumeManagerError(errorMessage, errorContext);
      }
    })();
    
    this.activeCreations.set(name, promise);
    try {
      return await promise;
    } finally {
      this.activeCreations.delete(name);
    }
  }

  async mountVolume(name: string, path: string): Promise<void> {
    this.cacheVolumes.set(path, name);
  }

  async removeVolume(name: string): Promise<void> {
    try {
      const volume = this.docker.getVolume(name);
      await volume.remove();
    } catch (error: any) {
      if (error.json?.message?.includes('no such volume')) {
        return;
      }
       throw new VolumeManagerError(`Failed to remove volume ${name}: ${error.message || 'Unknown error'} (stdout: ${error.stdout || 'N/A'}, stderr: ${error.stderr || 'N/A'})`, {
         message: error.message,
         stack: error.stack,
         stdout: error.stdout || 'N/A',
         stderr: error.stderr || 'N/A',
       });
    }
  }

  getDocker(): IDocker {
    return this.docker;
  }

  static resetStats() {
    VolumeManager.simulatedCacheVolumes.clear();
  }
 
  resetStats() {
    VolumeManager.resetStats();
    this.hits = 0;
    this.misses = 0;
    this.missedVolumes.clear();
    this.hitVolumes.clear();
  }
}
