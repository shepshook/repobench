# Task 2.7.2: Wire `cacheablePaths` into VolumeManager for Multi-Directory Caching

## Context Map
- `src/infrastructure/volume-manager.ts`: `VolumeManager` — currently creates volumes only for `cachePaths`.
- `src/infrastructure/sandbox.ts`: `Sandbox.init()` — passes `config.cachePaths` to `VolumeManager`.
- `src/core/contracts.ts`: `VolumeManager` interface.

## Technical Directive
1. Update `VolumeManager.createCacheVolume()` (or equivalent) to accept the full `cacheablePaths: string[]` array.
2. For each path in `cacheablePaths`:
   - Create a named Docker volume (or reuse existing) with a deterministic name based on a hash of the project path + cacheable path.
   - Mount the volume at the container path.
3. Ensure `VolumeManager` does not create a volume for a path that doesn't exist in the Docker image — validate inside `Sandbox` by checking if the directory exists before mounting.
4. Update the `SandboxConfig` interface in `src/core/contracts.ts` to use `cacheablePaths: string[]` (already done in Task 2.7.1).
5. Thread the config through `Sandbox.init()`:
   - Read `config.cacheablePaths` from the loaded config.
   - Pass to `VolumeManager.ensureVolumes(config.cacheablePaths)`.

## Testing
- Update `Sandbox` tests to verify multiple cacheable paths are mounted correctly.
- Update `VolumeManager` tests to verify volume creation for each path.
- Run full pipeline to ensure no regression in build times.
