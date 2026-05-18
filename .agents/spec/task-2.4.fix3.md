# Task 2.4.FIX3: Fix Sandbox Base Image Configuration

## Problem
The `baseImage` configuration is not being respected by the Sandbox, causing test failures.

## Objectives
- Review `Sandbox` initialization code to ensure `baseImage` is passed to the container creation config.

## Verification
Run `npm run test tests/integration/sandbox-image-config.test.ts` and `tests/infrastructure/sandbox-caching.test.ts` (base image test) and ensure they pass.

## Audit Feedback Round 1
The implementation of passing `baseImage` to the container creation appears correct. However, the tests are failing with a `TypeError: this.volumeManager.getDocker(...).pull is not a function` because the `MockDocker` infrastructure has not been updated to include the `pull` and `getImage` methods used in `Sandbox.initDocker`. The implementation is sound but the test suite is currently broken due to missing mock updates.

## Audit Feedback Round 2
The task remains in a failing state. As noted in Round 1, the infrastructure mocks (specifically `MockDocker`) have not been updated to accommodate the new `pull` and `getImage` requirements introduced by the fix. Please update the test infrastructure to match the production implementation before verifying the fix.

## Audit Feedback Round 3
The task remains in a failing state. While `MockDocker` has been updated, multiple tests (e.g., `tests/infrastructure/sandbox-image-path-verification.test.ts`) are using incomplete inline mocks for `IVolumeManager` that are missing the `getDocker()` method required by `Sandbox.initDocker`, resulting in `TypeError: this.volumeManager.getDocker is not a function`. Please ensure ALL mocks of `IVolumeManager` are updated to include `getDocker()`.
