# Task 1.1.1: Configuration Schema & Parser

## Context Map
- `src/core/contracts.ts`: Central location for shared types.
- `src/core/config.ts`: (To be created) Configuration logic.

## Technical Directive
1. Create `src/core/config.ts`.
2. Define a Zod schema `RepoBenchConfigSchema` with the following structure:
   - `mining`:
     - `keywords`: `z.array(z.string())`
     - `exclude_paths`: `z.array(z.string())`
     - `since`: `z.string().optional()` (ISO date)
     - `limit`: `z.number().optional()`
3. Export `RepoBenchConfig` type derived from the schema.
4. Implement `loadConfig(path: string = 'repobench.yaml'): Promise<RepoBenchConfig>`.
   - Use `js-yaml` or similar to parse the file.
   - Validate the result using `RepoBenchConfigSchema.parse()`.
   - Handle file-not-found by returning a default configuration: `{ mining: { keywords: [], exclude_paths: ['node_modules/', '.git/'], since: undefined, limit: undefined } }`.

## Testing
- Write unit tests for `loadConfig` in `tests/core/config.test.ts`:
  - Test loading a valid `repobench.yaml`.
  - Test loading a YAML with invalid types (should throw Zod error).
  - Test loading a non-existent file (should return defaults).
