# Task 2.4.1: Research & Define Caching Strategy

## Description
Investigate and define the optimal strategy for caching package dependencies (`node_modules`, `pip` environments) within the Docker sandbox to reduce initialization times.

## Requirements
- Research Docker volume mounting strategies for dependency caching.
- Define cache invalidation strategy (e.g., hashing `package-lock.json` or `requirements.txt`).
- Plan integration with existing `IVolumeManager` interface in `Sandbox` module.
- Extend `repobench.yaml` schema to support configurable base images and caching paths.

## DoD
- Defined caching strategy and invalidation logic documented.
- `repobench.yaml` schema updated to allow optional cache configuration.
- Integration plan with `IVolumeManager` defined.

## Audit Feedback Round 1
- **FAILED**: The requirement "Defined caching strategy and invalidation logic documented" has not been met. No design document or documentation within the codebase detailing the caching strategy and invalidation logic exists.
- **FAILED**: The requirement "Plan integration with existing `IVolumeManager` interface in `Sandbox` module" has not been met. No integration plan was found.
- **PASSED**: The requirement "Extend `repobench.yaml` schema to support configurable base images and caching paths" was met in `src/core/config.ts`.

## Audit Feedback Round 2
- **FAILED**: The caching strategy and invalidation logic documentation is still missing.
- **FAILED**: No integration plan with `IVolumeManager` has been created or documented.

## Audit Feedback Round 3
- **FAILED**: The caching strategy and invalidation logic documentation is still missing.
- **FAILED**: No integration plan with `IVolumeManager` has been created or documented.
- **Action Required**: Create a design document outlining the Docker volume caching strategy, including the hashing logic for invalidation (e.g., `package-lock.json` hash). Create a formal plan for the `IVolumeManager` interface integration within the `Sandbox` module and update this spec file to point to it.

## Audit Feedback Round 4
- **PASSED**: The implementation of the caching strategy using lockfile hashing in `VolumeManager.setupCacheVolumes` effectively handles invalidation.
- **FAILED**: The requirement "Defined caching strategy and invalidation logic documented" is not met. While the code implements the logic, there is no high-level design documentation explaining the chosen strategy, the rationale, or the invalidation flow.
- **FAILED**: The requirement "Integration plan with `IVolumeManager` defined" is not met. The code uses `IVolumeManager`, but there is no document formally outlining the integration plan.
- **Action Required**: Create a design document (e.g., `docs/caching-strategy.md` or similar) that documents the caching and invalidation strategy, and formalizes the `IVolumeManager` integration plan.

## Audit Feedback Round 5
- **FAILED**: The requirement "Defined caching strategy and invalidation logic documented" is not met. No design document was created.
- **FAILED**: The requirement "Integration plan with `IVolumeManager` defined" is not met. No integration plan document exists.
- **Action Required**: Create a design document (e.g., `docs/caching-strategy.md` or similar) that documents the caching and invalidation strategy, and formalizes the `IVolumeManager` integration plan as previously requested.


## Audit Feedback Round 8
- **FAILED**: The requirement "Defined caching strategy and invalidation logic documented" is not met. No design document (e.g., `docs/caching-strategy.md`) has been created to explain the caching and invalidation strategy.
- **FAILED**: The requirement "Integration plan with `IVolumeManager` defined" is not met. No formal documentation outlining the `IVolumeManager` integration plan exists.
- **Action Required**: Create a design document (e.g., `docs/caching-strategy.md` or similar) that documents the caching and invalidation strategy, and formalizes the `IVolumeManager` integration plan as previously requested.

