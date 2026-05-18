# Task 2.4.FIX1: Fix VolumeManager Docker Interaction

## Problem
The `VolumeManager` fails to interact with Docker correctly, resulting in failing tests for volume creation.

## Objectives
- Debug and fix `VolumeManager` interactions with the Docker API (`dockerode`).
- Ensure `createVolume` correctly calls the Docker API.

## Audit Feedback Round 2

- **Implementation Issue**: The singleton `dockerInstance` still exists in `VolumeManager`, violating the requirement for full Dependency Injection. Remove the singleton fallback in the constructor.
- **Code Quality**: Error handling in `createVolume` remains inadequate. According to `ARCHITECTURE.md` (Section 4.3), errors must include context like `stderr` or `stdout`, not just the `message` from `dockerode`.
- **Verification**: Tests fail with `ReferenceError` due to incorrect mocking/initialization of `Docker` instance in tests, likely exacerbated by the remaining singleton pattern. Fix the mock initialization in the test suites, and ensure `VolumeManager` can be fully initialized without relying on a singleton.

## Audit Feedback Round 5
- **Verification**: Tests still contain `// @ts-ignore` calls when instantiating `VolumeManager` in `tests/infrastructure/volume-manager-di.spec.ts` and `tests/infrastructure/volume-manager-audit-fix.test.ts`. This violates the requirement to refactor tests to explicitly inject dependencies without `// @ts-ignore`. Action Required: Remove all `// @ts-ignore` calls and ensure proper typing for the injected `Docker` mock.

## Audit Feedback Round 6
- **Verification**: Tests still contain `// @ts-ignore` calls in `tests/infrastructure/volume-manager-di.spec.ts` (lines 21, 36) and `tests/infrastructure/volume-manager-audit-fix.test.ts` (line 16). The requirement from Round 5 remains unfulfilled. Remove these calls and properly type the `Docker` mock to enforce Dependency Injection and ensure test reliability.

## Audit Feedback Round 7
- **Implementation Issue**: The singleton `dockerInstance` fallback in `VolumeManager` constructor (`this.docker = docker || new Docker();`) was NOT removed, failing the requirement to enforce strict Dependency Injection.
- **Verification**: Tests still use `as any` casting (`const vm = new VolumeManager(mockDocker as any);` in `tests/infrastructure/volume-manager-di.spec.ts`) instead of proper typing for the injected `Docker` mock. The requirement to remove all `// @ts-ignore` (and similar `as any` workarounds) and ensure proper typing remains unfulfilled.
- **Test Integrity**: The test `should throw if Docker instance is missing (DI enforcement)` in `tests/infrastructure/volume-manager-di.spec.ts` is currently failing/invalid because the constructor does not throw as implemented.

## Audit Feedback Round 8
- **Verification**: Still failing to meet strict Dependency Injection requirements in tests.
- **Issues Found**:
  - `tests/infrastructure/volume-manager-di.spec.ts`: Uses `as any` in `const vm = new VolumeManager(mockDocker as any);` (line 28).
  - `tests/infrastructure/volume-manager-audit-fix.test.ts`: Uses `// @ts-ignore` (line 16) and `as unknown as Docker` (line 17).
- **Requirement**: Remove all instances of `// @ts-ignore` and `as any` / `as unknown` in tests. Properly type the `mockDocker` to implement `IDocker`.
