# Task 2.4.3: Cache Lifecycle Management

## Description
Implement a mechanism for managing the cache lifecycle to prevent unbounded disk growth.

## Requirements
- Implement cache pruning/cleanup (e.g., TTL or max-size limits).
- Integrate cleanup into `SandboxManager` teardown logic or a background process.

## DoD
- Disk usage for caches is monitored/limited.
- Cache cleanup mechanism is implemented and verified.

## Audit Feedback Round 1
- **FAIL**: The implementation of `pruneCache` in `SandboxManager` only updates an in-memory array (`this.volumes`) and does not actually remove the corresponding Docker volumes from the system using `this.docker.getVolume(name).remove()`.
- **FAIL**: The tests in `tests\infrastructure\cache-lifecycle.test.ts` only verify the in-memory array state and do not verify that the actual Docker volumes are deleted from the disk.
- **Action Required**: Modify `pruneCache` to actually interact with the Docker API to remove orphaned volumes and update the tests to verify the physical removal.

## Audit Feedback Round 2
- **FAIL**: While `SandboxManager.pruneCache` appears to call `volume.remove()`, the tests in `tests\infrastructure\cache-lifecycle.test.ts` fail to verify this interaction.
- **FAIL**: The `SandboxManager` is not correctly mocked in the test, so the interaction with the Docker API cannot be verified, and the current code relies on `this.docker?.getVolume?.(volumeName)` returning `undefined` if `this.docker` is not properly configured, making the actual removal logic untested.
- **Action Required**: Update `tests\infrastructure\cache-lifecycle.test.ts` to properly mock `dockerode` and use `expect` to verify that `volume.remove()` is called on the volume objects returned by `docker.getVolume()`.
