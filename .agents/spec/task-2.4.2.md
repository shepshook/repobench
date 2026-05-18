# Task 2.4.2: Infrastructure Implementation (Volumes/Base Images)

## Description
Implement the caching mechanism in the `Sandbox` module, supporting mounted volumes for dependency directories and custom base images as defined in the configuration, ensuring integration with `IVolumeManager`.

## Requirements
- Implement volume mounting in `Sandbox` utilizing `IVolumeManager`.
- Ensure concurrency safety (prevent race conditions during simultaneous cache access).
- Ensure cache isolation per-project/per-agent to prevent cross-contamination.
- Ensure Docker containers are correctly configured with these volumes/base images.

## DoD
- Sandbox successfully mounts cache volumes via `IVolumeManager`.
- Docker containers use configured base images.
- Cache implementation is concurrency-safe and isolated.
- No regression in existing sandbox initialization logic.

## Audit Feedback Round 1
- **FAIL**: Implementation does not adhere to `SandboxConfig` and `IVolumeManager` contracts.
  - `Sandbox` utilizes `mountVolume` instead of `IVolumeManager.setupCacheVolumes` as required by the interface.
  - Integration tests in `tests/integration/sandbox-volume-mount.test.ts` incorrectly use `cachePaths` instead of `cacheVolumes` defined in `SandboxConfig`.
  - `tests/integration/sandbox-caching.test.ts` fails with `ReferenceError`, indicating issues with test setup/code quality.

## Audit Feedback Round 3
- **FAIL**: Implementation of `VolumeManager` is incomplete.
  - `VolumeManager.createVolume` does not interact with Docker to actually create a volume; it just returns a resolved promise, violating the requirement for infrastructure implementation.
  - Concurrency safety is only simulated and not robustly implemented as required.

