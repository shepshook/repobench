# Task 2.7.1: Add `cacheable_paths` Config to `repobench.yaml` Schema

## Context Map
- `src/core/config.ts`: Zod schema for `repobench.yaml` — currently has `sandbox.cache_paths` with a hardcoded default of `['/app/node_modules']`.
- `src/infrastructure/volume-manager.ts`: `VolumeManager` — mounts volumes for paths listed in `SandboxConfig.cachePaths`.
- `src/core/contracts.ts`: `SandboxConfig` interface — currently has `cachePaths: string[]`.

## Technical Directive
1. Rename `cache_paths` to `cacheable_paths` in the `repobench.yaml` Zod schema (keep snake_case in YAML, map to camelCase `cacheablePaths` in the typed config via the transform layer).
2. Add a `sandbox.cacheable_paths` entry to `repobench.yaml`:
   ```yaml
   sandbox:
     cacheable_paths:
       - /app/node_modules
       - /app/dist
       - /app/.next
   ```
3. Update the `SandboxConfig` interface in `src/core/contracts.ts`:
   - Rename `cachePaths` → `cacheablePaths`.
4. Add a transform in `src/core/config.ts` to convert `cache_paths` → `cacheablePaths` (matching existing pattern like `build_command` → `buildCommand`).
5. Default to `['/app/node_modules']` if not specified.

## Testing
- Update config tests to use `cacheable_paths` / `cacheablePaths`.
- Verify backward compatibility: loading an old `repobench.yaml` with `cache_paths` should still work via a migration warning (optional) or just pass through the renamed key.
- Run typecheck and lint.
