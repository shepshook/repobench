# Task 2.4.FIX5: Fix Caching Stats & Volume Mounting

## Problem
Caching statistics (hits/misses) and volume mounting logic are incorrect, leading to test failures.

## Objectives
- Fix `getCacheStats` calculation.
- Ensure `VolumeManager` is correctly utilized by `Sandbox`.

## Verification
Run `npm run test tests/integration/sandbox-benchmark.test.ts` and `tests/infrastructure/sandbox-caching.test.ts` and ensure they pass.

## Audit Feedback Round 1
- **Status: FAIL**
- **Findings**:
  - Integration tests failed with `VolumeManagerError: connect ENOENT //./pipe/docker_engine`, indicating issues with Docker initialization/fallback to simulation mode.
  - `getCacheStats` is not correctly reflecting hit/miss counts in the integration test environment.
  - Assertions for cache statistics in `sandbox-benchmark.test.ts` failed (`expected 1 to be 0` for hits).
- **Requirements**: Ensure that `Sandbox` correctly falls back to simulation mode when Docker is unavailable, and that `getCacheStats` accurately reports hits/misses based on the `VolumeManager` state.

## Audit Feedback Round 2
- **Status: FAIL**
- **Findings**:
  - The `BenchmarkService` creates a new `Sandbox` instance for each run, and each `Sandbox` instance creates a new `VolumeManager` instance.
  - The `hits` and `misses` in `VolumeManager` are instance-level variables, causing them to be reset to `0` whenever a new `Sandbox` (and thus `VolumeManager`) is created, violating the requirement to accurately report hits/misses across benchmark runs.
- **Requirements**: Refactor `VolumeManager` to persist cache statistics (e.g., using a singleton or persistent storage, or sharing the `VolumeManager` instance across `Sandbox` instances) to ensure accurate reporting of `getCacheStats` across different `Sandbox` lifecycle events.

## Audit Feedback Round 3
- **Status: FAIL**
- **Findings**:
  - The implementation still uses instance-level variables (`private hits = 0;`, `private misses = 0;`) for cache statistics in `VolumeManager`.
  - As noted in previous rounds, this causes cache statistics to reset to `0` whenever a new `VolumeManager` is instantiated, violating the requirement for accurate reporting across `Sandbox` lifecycle events.
  - No changes were made to persist these statistics (e.g., using `static` variables, a singleton pattern, or shared storage).
- **Requirements**: Refactor `VolumeManager` to persist cache statistics as requested in Round 2.

