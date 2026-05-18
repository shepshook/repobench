# Task 2.4.FIX2: Fix Sandbox Caching Persistence & Invalidation

## Problem
Sandbox cache is not persisting correctly and failing to invalidate on dependency file changes, causing test failures.

## Objectives
- Investigate `Sandbox.switchState` and cache management logic.
- Ensure dependency file hashing correctly triggers cache invalidation.
- Ensure volume mounts persist across instances.

## Verification

## Audit Feedback Round 1
The implementation is too restrictive, only supporting specific lock files (`package-lock.json`, `yarn.lock`, etc.). It fails to invalidate the cache when `package.json` (a crucial dependency file) is changed, as demonstrated by the test failure. 
- Please expand `Sandbox.detectLockFile` to include `package.json` or implement a more robust dependency detection mechanism that allows for configurable dependency files.

