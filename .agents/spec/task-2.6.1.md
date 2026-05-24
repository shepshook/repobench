# Task 2.6.1: Define Database Directory Config and Move `repobench.db` Outside Workspace

## Context Map
- `src/core/contracts.ts`: `IDatabase` interface, current `dbPath` config lives here.
- `src/core/config.ts`: Zod schema for `repobench.yaml` — needs a new `database` block.
- `src/infrastructure/database.ts`: `better-sqlite3` initialization — currently resolves `repobench.db` relative to CWD.
- `.gitignore`: Currently lists `repobench.db` to prevent tracking.

## Technical Directive
1. Add a new `database` block to the `repobench.yaml` Zod schema in `src/core/config.ts`:
   ```typescript
   database: z.object({
     path: z.string().optional().default('~/.repobench/db/repobench.db')
   }).optional().default({})
   ```
2. The default path must point outside any project directory that Docker bind-mounts or git manipulates. Use `~/.repobench/db/repobench.db` (expanded via `os.homedir()`) as the default.
3. Create a helper function `resolveDatabasePath(configPath?: string): string` that:
   - Uses the configured `database.path` if provided.
   - Expands `~` to `os.homedir()`.
   - Creates the parent directory if it does not exist (via `fs.mkdirSync` with `recursive: true`).
   - Resolves relative paths against the project root, not CWD.

## Testing
- Add unit tests for `resolveDatabasePath`:
  - Test default expansion to home directory.
  - Test absolute path override.
  - Test relative path resolution.
  - Test directory creation when parent does not exist.
- Ensure no existing tests break from the path change.
