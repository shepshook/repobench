# Caching Strategy

## Overview
RepoBench uses Docker volume mounting to cache dependencies (`node_modules`, pip environments, etc.) between benchmark runs. This significantly reduces initialization times by reusing existing dependency installations across environments with identical lockfile signatures.

## Invalidation Strategy
The cache is invalidated based on the content of the project's dependency lockfile (`package-lock.json`, `requirements.txt`, etc.).
1.  On sandbox initialization, `Sandbox` detects the presence of a supported lockfile.
2.  `VolumeManager` calculates a `sha256` hash of the lockfile's content.
3.  A volume name is constructed: `repobench-cache-<hash>`.
4.  If the lockfile changes, the hash changes, resulting in a new volume name, effectively bypassing the old, stale cache.

## Integration Plan
The integration is handled by the `Sandbox` module utilizing the `IVolumeManager` interface.
1.  **Detection**: `Sandbox` detects the lockfile before container creation.
2.  **Setup**: `Sandbox` calls `IVolumeManager.setupCacheVolumes(cachePaths, lockFile)`.
3.  **Consumption**: `VolumeManager` stores the calculated cache volume mappings.
4.  **Mounting**: After setup, `Sandbox` retrieves the configured cache volumes and includes them in the Docker `HostConfig.Binds` during container creation.

## Interface
```typescript
export interface IVolumeManager {
  setupCacheVolumes(cachePaths: string[], lockFile?: string): Promise<boolean>;
  getVolumes(): Record<string, string>;
}
```
